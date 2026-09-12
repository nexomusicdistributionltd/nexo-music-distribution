-- NEXO Music Distribution — pre-merge hardening (Batch 3)
-- Additive only. Does not rewrite 20260912000001_auth_foundation.sql.
-- profiles.id remains the PK and IS auth.users.id (no duplicate user_id column).

-- ---------------------------------------------------------------------------
-- 1. Schema alignment: profiles
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists timezone text;
alter table public.profiles add column if not exists language text;

comment on column public.profiles.id is
  'Primary key. This IS auth.users.id (the application user id). A separate user_id column is intentionally omitted to avoid a 1:1 duplicate key.';

comment on column public.profiles.timezone is
  'Optional IANA timezone (e.g. Europe/London).';

comment on column public.profiles.language is
  'Optional preferred language tag (e.g. en).';

-- ---------------------------------------------------------------------------
-- 2. Schema alignment: artist_profiles
-- ---------------------------------------------------------------------------
alter table public.artist_profiles add column if not exists artist_name text;
alter table public.artist_profiles add column if not exists country text;
alter table public.artist_profiles add column if not exists avatar_url text;
alter table public.artist_profiles add column if not exists cover_url text;
alter table public.artist_profiles
  add column if not exists profile_id uuid references public.profiles (id) on delete cascade;

update public.artist_profiles
set artist_name = stage_name
where artist_name is null;

update public.artist_profiles
set profile_id = user_id
where profile_id is null;

-- After backfill these are 1:1 with existing required columns
alter table public.artist_profiles alter column artist_name set not null;
alter table public.artist_profiles alter column profile_id set not null;

create unique index if not exists artist_profiles_profile_id_uidx
  on public.artist_profiles (profile_id);

comment on column public.artist_profiles.user_id is
  'Compatibility FK to profiles.id (same value as profile_id). Kept so existing queries continue to work.';

comment on column public.artist_profiles.profile_id is
  'Canonical FK to profiles.id. Equals user_id. profiles.id is the user id.';

comment on column public.artist_profiles.artist_name is
  'Canonical artist display name. Kept in sync with stage_name via trigger.';

-- Keep artist_name <-> stage_name and profile_id <-> user_id aligned
create or replace function public.sync_artist_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.artist_name is null or btrim(new.artist_name) = '' then
      new.artist_name := new.stage_name;
    end if;
    if new.stage_name is null or btrim(new.stage_name) = '' then
      new.stage_name := new.artist_name;
    end if;
    if new.profile_id is null then
      new.profile_id := new.user_id;
    end if;
    if new.user_id is null then
      new.user_id := new.profile_id;
    end if;
    return new;
  end if;

  if new.artist_name is distinct from old.artist_name then
    new.stage_name := new.artist_name;
  elsif new.stage_name is distinct from old.stage_name then
    new.artist_name := new.stage_name;
  end if;

  if new.profile_id is distinct from old.profile_id then
    new.user_id := new.profile_id;
  elsif new.user_id is distinct from old.user_id then
    new.profile_id := new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists artist_profiles_sync_fields on public.artist_profiles;
create trigger artist_profiles_sync_fields
  before insert or update on public.artist_profiles
  for each row execute function public.sync_artist_profile_fields();

-- ---------------------------------------------------------------------------
-- 3. Schema alignment: label_profiles
-- ---------------------------------------------------------------------------
alter table public.label_profiles add column if not exists legal_business_name text;
alter table public.label_profiles add column if not exists logo_url text;
alter table public.label_profiles add column if not exists description text;
alter table public.label_profiles add column if not exists country text;

update public.label_profiles
set legal_business_name = label_name
where legal_business_name is null;

comment on column public.label_profiles.legal_business_name is
  'Legal business name. Backfilled from label_name; label_name remains the trading name.';

-- ---------------------------------------------------------------------------
-- 4. Privilege escalation hard-stop (BEFORE UPDATE on profiles)
--    RLS remains; this trigger is the guarantee that non-admins cannot
--    change account_type or account_status.
--    auth.uid() IS NULL covers service role / GoTrue trigger context.
--    nexo.internal_profile_update is set by handle_user_email_confirmed
--    so email verification can flip pending_verification → active.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_type is not distinct from old.account_type
     and new.account_status is not distinct from old.account_status then
    return new;
  end if;

  if current_setting('nexo.internal_profile_update', true) = '1' then
    return new;
  end if;

  if auth.uid() is null
     or public.has_role(auth.uid(), 'admin')
     or public.has_role(auth.uid(), 'super_admin') then
    return new;
  end if;

  raise exception 'Changing account_type or account_status requires admin privileges'
    using errcode = '42501';
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- ---------------------------------------------------------------------------
-- 5. Harden write_audit_log
--    Authenticated: login, logout, profile_update, password_reset_request,
--                   signup, email_verified
--    Admin / super_admin only: role_change, status_change
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
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required to write audit logs'
      using errcode = '42501';
  end if;

  if p_action in ('role_change', 'status_change') then
    if not (
      public.has_role(uid, 'admin')
      or public.has_role(uid, 'super_admin')
    ) then
      raise exception 'role_change and status_change audit actions require admin privileges'
        using errcode = '42501';
    end if;
  elsif p_action not in (
    'login',
    'logout',
    'profile_update',
    'password_reset_request',
    'signup',
    'email_verified'
  ) then
    raise exception 'Audit action not allowed'
      using errcode = '42501';
  end if;

  -- Strip any secret-like keys
  safe_meta := coalesce(p_metadata, '{}'::jsonb)
    - 'password' - 'token' - 'access_token' - 'refresh_token' - 'service_role_key';

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, p_action, p_entity_type, coalesce(p_entity_id, uid), safe_meta)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.write_audit_log(public.audit_action, text, uuid, jsonb) from public;
grant execute on function public.write_audit_log(public.audit_action, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Replace handle_new_user to populate new columns (signup-safe)
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
  timezone_val text := nullif(new.raw_user_meta_data->>'timezone', '');
  language_val text := nullif(new.raw_user_meta_data->>'language', '');
  stage_name_val text := coalesce(new.raw_user_meta_data->>'stage_name', display_name_val);
  label_name_val text := coalesce(new.raw_user_meta_data->>'label_name', display_name_val);
  legal_name_val text := coalesce(
    nullif(new.raw_user_meta_data->>'legal_business_name', ''),
    label_name_val
  );
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
  if requested_role in ('support', 'admin', 'super_admin') then
    signup_role := 'public_user';
  end if;

  insert into public.profiles (
    id, email, full_name, display_name, country, timezone, language,
    account_status, account_type
  ) values (
    new.id,
    new.email,
    full_name_val,
    display_name_val,
    country_val,
    timezone_val,
    language_val,
    case when new.email_confirmed_at is not null then 'active'::public.account_status
         else 'pending_verification'::public.account_status end,
    signup_role::text
  );

  insert into public.user_roles (user_id, role)
  values (new.id, signup_role);

  if signup_role = 'artist' then
    insert into public.artist_profiles (
      user_id, profile_id, stage_name, artist_name, country
    ) values (
      new.id, new.id, stage_name_val, stage_name_val, country_val
    );
  elsif signup_role = 'label' then
    insert into public.label_profiles (
      user_id, label_name, contact_name, business_email,
      legal_business_name, country
    ) values (
      new.id, label_name_val, contact_name_val, business_email_val,
      legal_name_val, country_val
    );
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

-- Recreate email-confirm trigger fn so it can set the internal GUC
-- (needed so privilege trigger allows pending_verification → active).
create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform set_config('nexo.internal_profile_update', '1', true);

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
