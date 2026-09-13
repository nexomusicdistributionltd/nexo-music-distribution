-- Batch 6 — Catalog migration tables (additive)
-- External discovery returns unavailable when source not configured — never invent catalog.

do $$ begin
  create type public.catalog_migration_status as enum (
    'draft',
    'discovering',
    'review',
    'mapping',
    'importing',
    'completed',
    'cancelled',
    'failed',
    'unavailable'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.catalog_migration_item_status as enum (
    'pending',
    'matched_existing',
    'conflict',
    'ready',
    'imported',
    'skipped',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.catalog_conflict_status as enum (
    'open',
    'resolved_keep_existing',
    'resolved_import_new',
    'resolved_merge',
    'dismissed'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- catalog_migrations (auditable; never hard-deleted)
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_migrations (
  id uuid primary key default gen_random_uuid(),
  artist_profile_id uuid references public.artist_profiles (id) on delete set null,
  label_profile_id uuid references public.label_profiles (id) on delete set null,
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  source_name text not null default 'unconfigured',
  source_connected boolean not null default false,
  status public.catalog_migration_status not null default 'draft',
  title text,
  notes text,
  external_catalog_unavailable_reason text,
  item_count int not null default 0,
  conflict_count int not null default 0,
  imported_count int not null default 0,
  old_distributor_takedown_offered boolean not null default false,
  old_distributor_takedown_eligible boolean not null default false,
  delivery_verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz
);

create index if not exists catalog_migrations_owner_idx
  on public.catalog_migrations (owner_user_id, created_at desc);
create index if not exists catalog_migrations_status_idx
  on public.catalog_migrations (status, created_at desc);

drop trigger if exists catalog_migrations_set_updated_at on public.catalog_migrations;
create trigger catalog_migrations_set_updated_at
  before update on public.catalog_migrations
  for each row execute function public.set_updated_at();

-- Soft-delete only
create or replace function public.protect_catalog_migration_hard_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'catalog_migrations cannot be hard-deleted; set archived_at instead'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists catalog_migrations_no_hard_delete on public.catalog_migrations;
create trigger catalog_migrations_no_hard_delete
  before delete on public.catalog_migrations
  for each row execute function public.protect_catalog_migration_hard_delete();

-- ---------------------------------------------------------------------------
-- catalog_migration_items
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_migration_items (
  id uuid primary key default gen_random_uuid(),
  migration_id uuid not null references public.catalog_migrations (id) on delete cascade,
  external_release_id text,
  external_title text,
  external_artist_name text,
  external_upc text,
  external_isrcs text[] not null default '{}',
  external_track_count int,
  external_payload jsonb not null default '{}'::jsonb,
  matched_release_id uuid references public.releases (id) on delete set null,
  status public.catalog_migration_item_status not null default 'pending',
  conflict_reason text,
  isrc_preserved boolean not null default false,
  upc_preserved boolean not null default false,
  audio_fingerprint_hash text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_migration_items_migration_idx
  on public.catalog_migration_items (migration_id, status);
create index if not exists catalog_migration_items_upc_idx
  on public.catalog_migration_items (external_upc)
  where external_upc is not null;

drop trigger if exists catalog_migration_items_set_updated_at on public.catalog_migration_items;
create trigger catalog_migration_items_set_updated_at
  before update on public.catalog_migration_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- catalog_migration_conflicts
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_migration_conflicts (
  id uuid primary key default gen_random_uuid(),
  migration_id uuid not null references public.catalog_migrations (id) on delete cascade,
  item_id uuid not null references public.catalog_migration_items (id) on delete cascade,
  conflict_type text not null check (conflict_type in (
    'duplicate_isrc', 'duplicate_upc', 'duplicate_fingerprint', 'title_artist_match', 'manual'
  )),
  existing_release_id uuid references public.releases (id) on delete set null,
  existing_track_id uuid,
  details jsonb not null default '{}'::jsonb,
  status public.catalog_conflict_status not null default 'open',
  resolution_notes text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists catalog_migration_conflicts_open_idx
  on public.catalog_migration_conflicts (migration_id, status)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- artist_dsp_mappings
-- ---------------------------------------------------------------------------
create table if not exists public.artist_dsp_mappings (
  id uuid primary key default gen_random_uuid(),
  artist_profile_id uuid not null references public.artist_profiles (id) on delete cascade,
  dsp_name text not null,
  external_artist_id text,
  external_artist_uri text,
  external_artist_url text,
  verified boolean not null default false,
  source_connected boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_profile_id, dsp_name)
);

create index if not exists artist_dsp_mappings_artist_idx
  on public.artist_dsp_mappings (artist_profile_id);

drop trigger if exists artist_dsp_mappings_set_updated_at on public.artist_dsp_mappings;
create trigger artist_dsp_mappings_set_updated_at
  before update on public.artist_dsp_mappings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.catalog_migrations enable row level security;
alter table public.catalog_migration_items enable row level security;
alter table public.catalog_migration_conflicts enable row level security;
alter table public.artist_dsp_mappings enable row level security;

drop policy if exists "catalog_migrations_select" on public.catalog_migrations;
create policy "catalog_migrations_select" on public.catalog_migrations
  for select to authenticated
  using (public.is_staff(auth.uid()) or owner_user_id = auth.uid());

drop policy if exists "catalog_migrations_staff_insert" on public.catalog_migrations;
create policy "catalog_migrations_staff_insert" on public.catalog_migrations
  for insert to authenticated
  with check (public.is_staff(auth.uid()));

drop policy if exists "catalog_migrations_staff_update" on public.catalog_migrations;
create policy "catalog_migrations_staff_update" on public.catalog_migrations
  for update to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- No delete policy → hard delete blocked for clients; trigger blocks all deletes

drop policy if exists "catalog_migration_items_select" on public.catalog_migration_items;
create policy "catalog_migration_items_select" on public.catalog_migration_items
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.catalog_migrations m
      where m.id = migration_id and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists "catalog_migration_items_staff_write" on public.catalog_migration_items;
create policy "catalog_migration_items_staff_write" on public.catalog_migration_items
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists "catalog_migration_conflicts_select" on public.catalog_migration_conflicts;
create policy "catalog_migration_conflicts_select" on public.catalog_migration_conflicts
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.catalog_migrations m
      where m.id = migration_id and m.owner_user_id = auth.uid()
    )
  );

drop policy if exists "catalog_migration_conflicts_staff_write" on public.catalog_migration_conflicts;
create policy "catalog_migration_conflicts_staff_write" on public.catalog_migration_conflicts
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists "artist_dsp_mappings_select" on public.artist_dsp_mappings;
create policy "artist_dsp_mappings_select" on public.artist_dsp_mappings
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.artist_profiles ap
      where ap.id = artist_profile_id and ap.user_id = auth.uid()
    )
  );

drop policy if exists "artist_dsp_mappings_staff_write" on public.artist_dsp_mappings;
create policy "artist_dsp_mappings_staff_write" on public.artist_dsp_mappings
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_catalog_migration(
  p_owner_user_id uuid,
  p_artist_profile_id uuid default null,
  p_label_profile_id uuid default null,
  p_source_name text default 'unconfigured',
  p_title text default null,
  p_notes text default null
)
returns public.catalog_migrations
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  m public.catalog_migrations;
  connected boolean := false;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  -- External sources are never auto-connected without credentials
  connected := false;

  insert into public.catalog_migrations (
    owner_user_id, artist_profile_id, label_profile_id,
    source_name, source_connected, status, title, notes,
    external_catalog_unavailable_reason, created_by
  ) values (
    p_owner_user_id,
    p_artist_profile_id,
    p_label_profile_id,
    coalesce(nullif(trim(p_source_name), ''), 'unconfigured'),
    connected,
    case when connected then 'draft' else 'unavailable' end,
    p_title,
    p_notes,
    case when not connected then
      'External catalog source is not connected. Discovery cannot invent releases.'
    else null end,
    actor
  )
  returning * into m;

  perform public.write_audit_log(
    'catalog_migration'::public.audit_action,
    'catalog_migration',
    m.id,
    jsonb_build_object('source_name', m.source_name, 'status', m.status)
  );

  return m;
end;
$$;

revoke all on function public.create_catalog_migration(uuid, uuid, uuid, text, text, text) from public;
grant execute on function public.create_catalog_migration(uuid, uuid, uuid, text, text, text) to authenticated;

create or replace function public.offer_old_distributor_takedown(
  p_migration_id uuid
)
returns public.catalog_migrations
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  m public.catalog_migrations;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  select * into m from public.catalog_migrations where id = p_migration_id for update;
  if not found then
    raise exception 'Migration not found' using errcode = 'P0002';
  end if;

  -- Only after delivery verified — never automatic
  if m.delivery_verified_at is null or not m.old_distributor_takedown_eligible then
    raise exception 'Old-distributor takedown only offered after delivery is verified'
      using errcode = 'P0001';
  end if;

  update public.catalog_migrations
  set old_distributor_takedown_offered = true, updated_at = now()
  where id = m.id
  returning * into m;

  perform public.write_audit_log(
    'catalog_migration'::public.audit_action,
    'catalog_migration',
    m.id,
    jsonb_build_object('action', 'offer_old_distributor_takedown')
  );

  return m;
end;
$$;

revoke all on function public.offer_old_distributor_takedown(uuid) from public;
grant execute on function public.offer_old_distributor_takedown(uuid) to authenticated;

create or replace function public.upsert_artist_dsp_mapping(
  p_artist_profile_id uuid,
  p_dsp_name text,
  p_external_artist_id text default null,
  p_external_artist_uri text default null,
  p_external_artist_url text default null,
  p_verified boolean default false
)
returns public.artist_dsp_mappings
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row public.artist_dsp_mappings;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  if p_dsp_name is null or length(trim(p_dsp_name)) = 0 then
    raise exception 'dsp_name required' using errcode = 'P0001';
  end if;

  insert into public.artist_dsp_mappings (
    artist_profile_id, dsp_name, external_artist_id, external_artist_uri,
    external_artist_url, verified, source_connected, created_by
  ) values (
    p_artist_profile_id, lower(trim(p_dsp_name)), p_external_artist_id,
    p_external_artist_uri, p_external_artist_url, coalesce(p_verified, false),
    false, -- never claim connected without real source credentials
    actor
  )
  on conflict (artist_profile_id, dsp_name) do update
    set external_artist_id = excluded.external_artist_id,
        external_artist_uri = excluded.external_artist_uri,
        external_artist_url = excluded.external_artist_url,
        verified = excluded.verified,
        updated_at = now()
  returning * into row;

  perform public.write_audit_log(
    'catalog_mapping'::public.audit_action,
    'artist_profile',
    p_artist_profile_id,
    jsonb_build_object('dsp_name', row.dsp_name, 'mapping_id', row.id)
  );

  return row;
end;
$$;

revoke all on function public.upsert_artist_dsp_mapping(uuid, text, text, text, text, boolean) from public;
grant execute on function public.upsert_artist_dsp_mapping(uuid, text, text, text, text, boolean) to authenticated;

comment on table public.catalog_migrations is 'Catalog migration runs. Never invent external catalog; unavailable when source not connected. Never hard-deleted.';
comment on table public.artist_dsp_mappings is 'Manual/verified DSP artist ID mappings. source_connected stays false without real API credentials.';
