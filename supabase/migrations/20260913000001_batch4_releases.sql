-- NEXO Music Distribution — Batch 4: releases, catalog, notifications, storage, provider links
-- Additive. Depends on Batch 3 auth foundation + hardening.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.release_type as enum ('single', 'ep', 'album');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.release_status as enum (
    'draft',
    'submitted',
    'in_qc',
    'changes_requested',
    'approved',
    'rejected',
    'scheduled',
    'delivering',
    'delivered',
    'live',
    'takedown_requested',
    'taken_down'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.asset_kind as enum ('audio', 'artwork', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.contributor_role as enum (
    'primary_artist',
    'featured_artist',
    'remixer',
    'producer',
    'songwriter',
    'composer',
    'lyricist',
    'mixer',
    'engineer',
    'publisher',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_type as enum (
    'release_submitted',
    'release_status_changed',
    'qc_changes_requested',
    'qc_approved',
    'qc_rejected',
    'release_live',
    'takedown_update',
    'system',
    'provider_not_connected'
  );
exception when duplicate_object then null;
end $$;

-- audit_action values added in 20260913000000_batch4_audit_enum.sql

-- ---------------------------------------------------------------------------
-- releases
-- ---------------------------------------------------------------------------
create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  artist_profile_id uuid references public.artist_profiles (id) on delete set null,
  label_profile_id uuid references public.label_profiles (id) on delete set null,
  release_type public.release_type not null default 'single',
  title text not null default '',
  version text,
  primary_artist_name text not null default '',
  genre text,
  subgenre text,
  language text,
  release_date date,
  original_release_date date,
  label_name text,
  copyright_year int,
  copyright_line text,
  phonogram_line text,
  upc text,
  explicit boolean not null default false,
  description text,
  territories text[] not null default array['WW']::text[],
  distribution_settings jsonb not null default '{}'::jsonb,
  status public.release_status not null default 'draft',
  locked_at timestamptz,
  submitted_at timestamptz,
  rejection_reason text,
  changes_requested_reason text,
  -- Provider fields — never settable by end users via RLS/triggers
  provider_name text,
  provider_release_id text,
  provider_status text,
  provider_metadata jsonb not null default '{}'::jsonb,
  provider_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint releases_title_len check (char_length(title) <= 500),
  constraint releases_upc_format check (upc is null or upc ~ '^[0-9]{12,14}$')
);

create index if not exists releases_owner_idx on public.releases (owner_user_id);
create index if not exists releases_status_idx on public.releases (status);
create index if not exists releases_created_at_idx on public.releases (created_at desc);
create index if not exists releases_title_idx on public.releases using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(primary_artist_name,'')));
create index if not exists releases_artist_profile_idx on public.releases (artist_profile_id);
create index if not exists releases_label_profile_idx on public.releases (label_profile_id);

drop trigger if exists releases_set_updated_at on public.releases;
create trigger releases_set_updated_at
  before update on public.releases
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- release_tracks
-- ---------------------------------------------------------------------------
create table if not exists public.release_tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  track_number int not null check (track_number > 0),
  title text not null default '',
  version text,
  isrc text,
  duration_ms int,
  explicit boolean not null default false,
  language text,
  lyrics text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint release_tracks_isrc_format check (isrc is null or isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'),
  unique (release_id, track_number)
);

create index if not exists release_tracks_release_idx on public.release_tracks (release_id);

drop trigger if exists release_tracks_set_updated_at on public.release_tracks;
create trigger release_tracks_set_updated_at
  before update on public.release_tracks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- release_contributors
-- ---------------------------------------------------------------------------
create table if not exists public.release_contributors (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  track_id uuid references public.release_tracks (id) on delete cascade,
  name text not null,
  role public.contributor_role not null default 'other',
  share_percent numeric(5,2) check (share_percent is null or (share_percent >= 0 and share_percent <= 100)),
  created_at timestamptz not null default now()
);

create index if not exists release_contributors_release_idx on public.release_contributors (release_id);
create index if not exists release_contributors_track_idx on public.release_contributors (track_id);

-- ---------------------------------------------------------------------------
-- release_assets
-- ---------------------------------------------------------------------------
create table if not exists public.release_assets (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  track_id uuid references public.release_tracks (id) on delete set null,
  kind public.asset_kind not null,
  storage_bucket text not null,
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint,
  checksum text,
  width int,
  height int,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists release_assets_release_idx on public.release_assets (release_id);
create index if not exists release_assets_track_idx on public.release_assets (track_id);

-- ---------------------------------------------------------------------------
-- release_status_history
-- ---------------------------------------------------------------------------
create table if not exists public.release_status_history (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  previous_status public.release_status,
  new_status public.release_status not null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists release_status_history_release_idx
  on public.release_status_history (release_id, created_at desc);

-- ---------------------------------------------------------------------------
-- release_submissions
-- ---------------------------------------------------------------------------
create table if not exists public.release_submissions (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  validation_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  superseded boolean not null default false
);

create index if not exists release_submissions_release_idx
  on public.release_submissions (release_id, submitted_at desc);

-- ---------------------------------------------------------------------------
-- provider_release_links
-- ---------------------------------------------------------------------------
create table if not exists public.provider_release_links (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  provider_name text not null,
  provider_release_id text,
  provider_status text,
  delivery_status text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (release_id, provider_name)
);

create index if not exists provider_release_links_release_idx on public.provider_release_links (release_id);

drop trigger if exists provider_release_links_set_updated_at on public.provider_release_links;
create trigger provider_release_links_set_updated_at
  before update on public.provider_release_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null default 'system',
  title text not null,
  body text not null default '',
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Ownership helper
-- ---------------------------------------------------------------------------
create or replace function public.owns_release(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.releases r
    where r.id = rid and r.owner_user_id = auth.uid()
  );
$$;

create or replace function public.release_is_editable(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.releases r
    where r.id = rid
      and r.owner_user_id = auth.uid()
      and r.status in ('draft', 'changes_requested')
  );
$$;

-- ---------------------------------------------------------------------------
-- Protect privileged release columns from end users
-- ---------------------------------------------------------------------------
create or replace function public.protect_release_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  staff boolean;
  internal boolean;
begin
  internal := current_setting('nexo.internal_release_update', true) = '1';
  staff := auth.uid() is null
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support');

  if tg_op = 'INSERT' then
    if not staff and not internal then
      -- End users may only create drafts with no provider / approved-like fields
      new.status := 'draft';
      new.provider_name := null;
      new.provider_release_id := null;
      new.provider_status := null;
      new.provider_metadata := '{}'::jsonb;
      new.provider_connected := false;
      new.locked_at := null;
      new.submitted_at := null;
      new.rejection_reason := null;
    end if;
    return new;
  end if;

  -- UPDATE
  if staff or internal then
    return new;
  end if;

  -- Non-staff cannot change status except via SECURITY DEFINER RPCs
  if new.status is distinct from old.status then
    raise exception 'Status changes must go through server-enforced transitions'
      using errcode = '42501';
  end if;

  if new.provider_name is distinct from old.provider_name
     or new.provider_release_id is distinct from old.provider_release_id
     or new.provider_status is distinct from old.provider_status
     or new.provider_metadata is distinct from old.provider_metadata
     or new.provider_connected is distinct from old.provider_connected
     or new.locked_at is distinct from old.locked_at
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Provider and lock fields are not user-editable'
      using errcode = '42501';
  end if;

  -- Block edits when locked / not editable
  if old.status not in ('draft', 'changes_requested') then
    raise exception 'Release is locked and cannot be edited in status %', old.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists releases_protect_privileged on public.releases;
create trigger releases_protect_privileged
  before insert or update on public.releases
  for each row execute function public.protect_release_privileged_fields();

-- Child tables: only editable when parent is editable
create or replace function public.enforce_release_child_editability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  staff boolean;
begin
  staff := auth.uid() is null
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support');
  if staff or current_setting('nexo.internal_release_update', true) = '1' then
    return coalesce(new, old);
  end if;

  rid := coalesce(new.release_id, old.release_id);
  if not public.release_is_editable(rid) then
    raise exception 'Release content is locked'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists release_tracks_edit_guard on public.release_tracks;
create trigger release_tracks_edit_guard
  before insert or update or delete on public.release_tracks
  for each row execute function public.enforce_release_child_editability();

drop trigger if exists release_contributors_edit_guard on public.release_contributors;
create trigger release_contributors_edit_guard
  before insert or update or delete on public.release_contributors
  for each row execute function public.enforce_release_child_editability();

drop trigger if exists release_assets_edit_guard on public.release_assets;
create trigger release_assets_edit_guard
  before insert or update or delete on public.release_assets
  for each row execute function public.enforce_release_child_editability();

-- ---------------------------------------------------------------------------
-- Server-enforced status transition (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function public.transition_release_status(
  p_release_id uuid,
  p_new_status public.release_status,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.releases;
  actor uuid := auth.uid();
  staff boolean;
  owner_ok boolean;
  allowed boolean := false;
begin
  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  staff := actor is not null and (
    public.has_role(actor, 'admin')
    or public.has_role(actor, 'super_admin')
    or public.has_role(actor, 'support')
  );
  owner_ok := actor is not null and r.owner_user_id = actor;

  -- Owner transitions
  if owner_ok and not staff then
    if r.status in ('draft', 'changes_requested') and p_new_status = 'submitted' then
      allowed := true;
    elsif r.status in ('approved', 'scheduled', 'delivered', 'live')
          and p_new_status = 'takedown_requested' then
      allowed := true;
    end if;
  end if;

  -- Staff transitions (QC / ops) — still no fake delivery
  if staff then
    if r.status = 'submitted' and p_new_status in ('in_qc', 'changes_requested', 'rejected', 'approved') then
      allowed := true;
    elsif r.status = 'in_qc' and p_new_status in ('changes_requested', 'rejected', 'approved') then
      allowed := true;
    elsif r.status = 'approved' and p_new_status in ('scheduled', 'rejected', 'changes_requested') then
      allowed := true;
    elsif r.status = 'scheduled' and p_new_status in ('delivering', 'changes_requested') then
      -- delivering only meaningful when provider connected — app layer also checks
      allowed := true;
    elsif r.status = 'delivering' and p_new_status in ('delivered', 'live', 'rejected') then
      allowed := true;
    elsif r.status = 'delivered' and p_new_status in ('live') then
      allowed := true;
    elsif r.status = 'takedown_requested' and p_new_status in ('taken_down', 'live', 'delivered') then
      allowed := true;
    elsif r.status = 'rejected' and p_new_status in ('draft', 'changes_requested') then
      allowed := true;
    end if;
  end if;

  if not allowed then
    raise exception 'Transition from % to % is not permitted for this actor', r.status, p_new_status
      using errcode = '42501';
  end if;

  -- Provider-gated statuses cannot be reached without a connected provider
  if p_new_status in ('delivering', 'delivered', 'live') and not r.provider_connected then
    raise exception 'Provider not connected — cannot move to %', p_new_status
      using errcode = 'P0001';
  end if;

  perform set_config('nexo.internal_release_update', '1', true);

  insert into public.release_status_history (release_id, previous_status, new_status, actor_user_id, reason, metadata)
  values (r.id, r.status, p_new_status, actor, p_reason, coalesce(p_metadata, '{}'::jsonb));

  update public.releases
  set
    status = p_new_status,
    submitted_at = case when p_new_status = 'submitted' then now() else submitted_at end,
    locked_at = case
      when p_new_status in ('submitted', 'in_qc', 'approved', 'scheduled', 'delivering', 'delivered', 'live', 'takedown_requested', 'taken_down')
        then coalesce(locked_at, now())
      when p_new_status in ('draft', 'changes_requested')
        then null
      else locked_at
    end,
    rejection_reason = case when p_new_status = 'rejected' then p_reason else rejection_reason end,
    changes_requested_reason = case when p_new_status = 'changes_requested' then p_reason else changes_requested_reason end,
    updated_at = now()
  where id = r.id
  returning * into r;

  perform set_config('nexo.internal_release_update', '0', true);

  return r;
end;
$$;

revoke all on function public.transition_release_status(uuid, public.release_status, text, jsonb) from public;
grant execute on function public.transition_release_status(uuid, public.release_status, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Submit release to QC (owner) — validates + creates submission row + notifies staff
-- ---------------------------------------------------------------------------
create or replace function public.submit_release_to_qc(
  p_release_id uuid,
  p_validation_snapshot jsonb default '{}'::jsonb,
  p_notes text default null
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.releases;
  actor uuid := auth.uid();
  staff_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;
  if r.owner_user_id <> actor then
    raise exception 'Not release owner' using errcode = '42501';
  end if;
  if r.status not in ('draft', 'changes_requested') then
    raise exception 'Release already submitted or locked (status=%)', r.status
      using errcode = 'P0001';
  end if;

  -- Mark prior submissions superseded
  update public.release_submissions
  set superseded = true
  where release_id = p_release_id and not superseded;

  insert into public.release_submissions (release_id, submitted_by, validation_snapshot, notes)
  values (p_release_id, actor, coalesce(p_validation_snapshot, '{}'::jsonb), p_notes);

  r := public.transition_release_status(p_release_id, 'submitted', p_notes, jsonb_build_object('source', 'submit_release_to_qc'));

  -- Notify staff (admin / super_admin / support)
  for staff_id in
    select distinct ur.user_id from public.user_roles ur
    where ur.role in ('admin', 'super_admin', 'support')
  loop
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      staff_id,
      'release_submitted',
      'Release submitted for QC',
      coalesce(r.title, 'Untitled') || ' was submitted for quality control.',
      'release',
      r.id
    );
  end loop;

  -- Notify owner
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  values (
    actor,
    'release_status_changed',
    'Release submitted',
    'Your release "' || coalesce(r.title, 'Untitled') || '" was submitted to QC.',
    'release',
    r.id
  );

  return r;
end;
$$;

revoke all on function public.submit_release_to_qc(uuid, jsonb, text) from public;
grant execute on function public.submit_release_to_qc(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.releases enable row level security;
alter table public.release_tracks enable row level security;
alter table public.release_contributors enable row level security;
alter table public.release_assets enable row level security;
alter table public.release_status_history enable row level security;
alter table public.release_submissions enable row level security;
alter table public.provider_release_links enable row level security;
alter table public.notifications enable row level security;

-- releases
drop policy if exists "releases_select_own_or_staff" on public.releases;
create policy "releases_select_own_or_staff" on public.releases
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists "releases_insert_own" on public.releases;
create policy "releases_insert_own" on public.releases
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and (
      public.has_role(auth.uid(), 'artist')
      or public.has_role(auth.uid(), 'label')
      or public.is_staff(auth.uid())
    )
  );

drop policy if exists "releases_update_own" on public.releases;
create policy "releases_update_own" on public.releases
  for update to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists "releases_delete_own_draft" on public.releases;
create policy "releases_delete_own_draft" on public.releases
  for delete to authenticated
  using (
    (owner_user_id = auth.uid() and status = 'draft')
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
  );

-- Helper macro-style policies for children
drop policy if exists "release_tracks_all_own" on public.release_tracks;
create policy "release_tracks_all_own" on public.release_tracks
  for all to authenticated
  using (public.owns_release(release_id) or public.is_staff(auth.uid()))
  with check (public.owns_release(release_id) or public.is_staff(auth.uid()));

drop policy if exists "release_contributors_all_own" on public.release_contributors;
create policy "release_contributors_all_own" on public.release_contributors
  for all to authenticated
  using (public.owns_release(release_id) or public.is_staff(auth.uid()))
  with check (public.owns_release(release_id) or public.is_staff(auth.uid()));

drop policy if exists "release_assets_all_own" on public.release_assets;
create policy "release_assets_all_own" on public.release_assets
  for all to authenticated
  using (public.owns_release(release_id) or public.is_staff(auth.uid()))
  with check (public.owns_release(release_id) or public.is_staff(auth.uid()));

drop policy if exists "release_status_history_select" on public.release_status_history;
create policy "release_status_history_select" on public.release_status_history
  for select to authenticated
  using (public.owns_release(release_id) or public.is_staff(auth.uid()));

-- history inserts only via SECURITY DEFINER functions
drop policy if exists "release_status_history_no_direct_insert" on public.release_status_history;
create policy "release_status_history_no_direct_insert" on public.release_status_history
  for insert to authenticated
  with check (false);

drop policy if exists "release_submissions_select" on public.release_submissions;
create policy "release_submissions_select" on public.release_submissions
  for select to authenticated
  using (public.owns_release(release_id) or public.is_staff(auth.uid()));

drop policy if exists "release_submissions_no_direct_insert" on public.release_submissions;
create policy "release_submissions_no_direct_insert" on public.release_submissions
  for insert to authenticated
  with check (false);

drop policy if exists "provider_links_select" on public.provider_release_links;
create policy "provider_links_select" on public.provider_release_links
  for select to authenticated
  using (public.owns_release(release_id) or public.is_staff(auth.uid()));

-- only staff/service can mutate provider links
drop policy if exists "provider_links_staff_write" on public.provider_release_links;
create policy "provider_links_staff_write" on public.provider_release_links
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- inserts via security definer / staff
drop policy if exists "notifications_insert_staff_or_self_system" on public.notifications;
create policy "notifications_insert_staff_or_self_system" on public.notifications
  for insert to authenticated
  with check (public.is_staff(auth.uid()) or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage buckets (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'release-audio',
  'release-audio',
  false,
  524288000, -- 500MB
  array['audio/wav', 'audio/x-wav', 'audio/flac', 'audio/mpeg', 'audio/mp3', 'audio/aiff', 'audio/x-aiff', 'audio/mp4', 'audio/x-m4a']
)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'release-artwork',
  'release-artwork',
  false,
  52428800, -- 50MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set public = excluded.public;

-- Path convention: {user_id}/{release_id}/{filename}
drop policy if exists "release_audio_select_own" on storage.objects;
create policy "release_audio_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'release-audio'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff(auth.uid())
    )
  );

drop policy if exists "release_audio_insert_own" on storage.objects;
create policy "release_audio_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'release-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "release_audio_update_own" on storage.objects;
create policy "release_audio_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'release-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "release_audio_delete_own" on storage.objects;
create policy "release_audio_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'release-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "release_artwork_select_own" on storage.objects;
create policy "release_artwork_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'release-artwork'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff(auth.uid())
    )
  );

drop policy if exists "release_artwork_insert_own" on storage.objects;
create policy "release_artwork_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'release-artwork'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "release_artwork_update_own" on storage.objects;
create policy "release_artwork_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'release-artwork'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "release_artwork_delete_own" on storage.objects;
create policy "release_artwork_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'release-artwork'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Realtime publication (best-effort)
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.releases;
exception when others then null;
end $$;

comment on table public.releases is 'Batch 4 release catalog. Provider delivery requires a connected adapter.';
comment on column public.releases.provider_connected is 'False until a real distribution provider is configured. Blocks delivering/delivered/live.';
comment on column public.releases.upc is 'User-supplied only — never auto-fabricated.';

-- ---------------------------------------------------------------------------
-- Allow Batch 4 audit actions for authenticated users
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
    'email_verified',
    'release_create',
    'release_update',
    'release_submit',
    'release_status_change',
    'release_duplicate',
    'release_takedown_request',
    'asset_upload'
  ) then
    raise exception 'Audit action not allowed'
      using errcode = '42501';
  end if;

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
