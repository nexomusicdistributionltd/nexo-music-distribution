-- NEXO Music Distribution — Batch 3 auth foundation
-- Roles (DB only): public_user, artist, label, support, admin, super_admin
-- Public signup may only create artist | label via SECURITY DEFINER trigger.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum (
    'public_user',
    'artist',
    'label',
    'support',
    'admin',
    'super_admin'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.account_status as enum (
    'active',
    'pending_verification',
    'suspended',
    'deactivated'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.audit_action as enum (
    'login',
    'logout',
    'profile_update',
    'role_change',
    'status_change',
    'signup',
    'password_reset_request',
    'email_verified'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  display_name text not null default '',
  country text,
  avatar_url text,
  account_status public.account_status not null default 'pending_verification',
  account_type text not null default 'public_user'
    check (account_type in ('public_user', 'artist', 'label', 'support', 'admin', 'super_admin')),
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_account_status_idx on public.profiles (account_status);

-- ---------------------------------------------------------------------------
-- artist_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.artist_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  stage_name text not null,
  bio text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artist_profiles_user_id_idx on public.artist_profiles (user_id);

-- ---------------------------------------------------------------------------
-- label_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.label_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  label_name text not null,
  contact_name text not null,
  business_email text not null,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists label_profiles_user_id_idx on public.label_profiles (user_id);

-- ---------------------------------------------------------------------------
-- user_roles (roles live here — never editable by the user themselves)
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  unique (user_id, role)
);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role);

-- ---------------------------------------------------------------------------
-- audit_logs (never store passwords / tokens)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  action public.audit_action not null,
  entity_type text not null default 'user',
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint audit_logs_no_secrets check (
    not (metadata ? 'password')
    and not (metadata ? 'token')
    and not (metadata ? 'access_token')
    and not (metadata ? 'refresh_token')
    and not (metadata ? 'service_role_key')
  )
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_user_id);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists artist_profiles_set_updated_at on public.artist_profiles;
create trigger artist_profiles_set_updated_at
  before update on public.artist_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists label_profiles_set_updated_at on public.label_profiles;
create trigger label_profiles_set_updated_at
  before update on public.label_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(uid uuid, r public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = uid and ur.role = r
  );
$$;

create or replace function public.is_staff(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = uid
      and ur.role in ('support', 'admin', 'super_admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Signup trigger: create profile + role + artist/label profile
-- Only artist | label allowed from public signup metadata.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := lower(coalesce(new.raw_user_meta_data->>'role', ''));
  signup_role public.app_role;
  full_name_val text := coalesce(new.raw_user_meta_data->>'full_name', '');
  display_name_val text := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'stage_name',
    new.raw_user_meta_data->>'label_name',
    full_name_val,
    split_part(new.email, '@', 1)
  );
  country_val text := nullif(new.raw_user_meta_data->>'country', '');
  stage_name_val text := coalesce(new.raw_user_meta_data->>'stage_name', display_name_val);
  label_name_val text := coalesce(new.raw_user_meta_data->>'label_name', display_name_val);
  contact_name_val text := coalesce(new.raw_user_meta_data->>'contact_name', full_name_val);
  business_email_val text := coalesce(new.raw_user_meta_data->>'business_email', new.email);
begin
  if requested_role = 'artist' then
    signup_role := 'artist';
  elsif requested_role = 'label' then
    signup_role := 'label';
  else
    -- Default safe role; privileged roles cannot be self-assigned
    signup_role := 'public_user';
  end if;

  -- Block privileged self-signup even if metadata is forged
  if requested_role in ('support', 'admin', 'super_admin', 'public_user') and requested_role <> 'public_user' then
    signup_role := 'public_user';
  end if;
  if requested_role in ('support', 'admin', 'super_admin') then
    signup_role := 'public_user';
  end if;

  insert into public.profiles (
    id, email, full_name, display_name, country, account_status, account_type
  ) values (
    new.id,
    new.email,
    full_name_val,
    display_name_val,
    country_val,
    case when new.email_confirmed_at is not null then 'active'::public.account_status
         else 'pending_verification'::public.account_status end,
    signup_role::text
  );

  insert into public.user_roles (user_id, role)
  values (new.id, signup_role);

  if signup_role = 'artist' then
    insert into public.artist_profiles (user_id, stage_name)
    values (new.id, stage_name_val);
  elsif signup_role = 'label' then
    insert into public.label_profiles (user_id, label_name, contact_name, business_email)
    values (new.id, label_name_val, contact_name_val, business_email_val);
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    new.id,
    'signup',
    'user',
    new.id,
    jsonb_build_object('role', signup_role::text, 'email', new.email)
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sync email verification → profile status
create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
    set
      email_verified_at = new.email_confirmed_at,
      account_status = case
        when account_status = 'pending_verification' then 'active'::public.account_status
        else account_status
      end,
      updated_at = now()
    where id = new.id;

    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (
      new.id,
      'email_verified',
      'user',
      new.id,
      jsonb_build_object('email', new.email)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_email_confirmed();

-- ---------------------------------------------------------------------------
-- Audit helper callable from app (authenticated)
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_action public.audit_action,
  p_entity_type text default 'user',
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  safe_meta jsonb;
begin
  -- Strip any secret-like keys
  safe_meta := coalesce(p_metadata, '{}'::jsonb)
    - 'password' - 'token' - 'access_token' - 'refresh_token' - 'service_role_key';

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, coalesce(p_entity_id, auth.uid()), safe_meta)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.write_audit_log(public.audit_action, text, uuid, jsonb) from public;
grant execute on function public.write_audit_log(public.audit_action, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.artist_profiles enable row level security;
alter table public.label_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: own row only (read/update). No insert/delete for clients.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_staff(auth.uid())
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Prevent privilege escalation via account_type / status
    and account_type = (select p.account_type from public.profiles p where p.id = auth.uid())
    and account_status = (select p.account_status from public.profiles p where p.id = auth.uid())
  );

-- Staff may update status (admin tooling); account_type still guarded in app
drop policy if exists "profiles_staff_update" on public.profiles;
create policy "profiles_staff_update" on public.profiles
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

-- artist_profiles
drop policy if exists "artist_profiles_select_own" on public.artist_profiles;
create policy "artist_profiles_select_own" on public.artist_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists "artist_profiles_update_own" on public.artist_profiles;
create policy "artist_profiles_update_own" on public.artist_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- label_profiles
drop policy if exists "label_profiles_select_own" on public.label_profiles;
create policy "label_profiles_select_own" on public.label_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists "label_profiles_update_own" on public.label_profiles;
create policy "label_profiles_update_own" on public.label_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- user_roles: read own (or staff). No self-insert/update/delete.
drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

-- Only super_admin can mutate roles via RLS (admins typically use service role)
drop policy if exists "user_roles_super_admin_all" on public.user_roles;
create policy "user_roles_super_admin_all" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- audit_logs: users can insert own via function; staff can read
drop policy if exists "audit_logs_select_staff" on public.audit_logs;
create policy "audit_logs_select_staff" on public.audit_logs
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support')
  );

drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own" on public.audit_logs
  for insert to authenticated
  with check (actor_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage bucket prep for avatars (policies apply once bucket exists)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar_images_public_read" on storage.objects;
create policy "avatar_images_public_read" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatar_images_own_upload" on storage.objects;
create policy "avatar_images_own_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar_images_own_update" on storage.objects;
create policy "avatar_images_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar_images_own_delete" on storage.objects;
create policy "avatar_images_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
