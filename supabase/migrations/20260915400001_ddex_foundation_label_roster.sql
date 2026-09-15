-- NEXO — Label roster + DDEX foundation (additive only)
-- CRITICAL: roster artists reuse artist_profiles with nullable user_id/profile_id.
-- Creating a roster artist MUST NOT mutate profiles.account_type, user_roles, or create auth.users.
-- No ERN XML generation. No DSP endpoints. No fake ISRC/UPC.

-- ---------------------------------------------------------------------------
-- A) artist_profiles: nullable login linkage for managed roster artists
-- ---------------------------------------------------------------------------
alter table public.artist_profiles
  alter column user_id drop not null;

alter table public.artist_profiles
  alter column profile_id drop not null;

-- Drop blanket unique on user_id if it blocks multiple NULLs oddly; recreate as partial.
-- Postgres UNIQUE already allows multiple NULLs; keep constraint, add partial for clarity.
alter table public.artist_profiles
  add column if not exists created_by_label_profile_id uuid
    references public.label_profiles (id) on delete set null;

create index if not exists artist_profiles_created_by_label_idx
  on public.artist_profiles (created_by_label_profile_id)
  where created_by_label_profile_id is not null;

-- Login artists: user_id unique when present
drop index if exists artist_profiles_user_id_login_uidx;
create unique index artist_profiles_user_id_login_uidx
  on public.artist_profiles (user_id)
  where user_id is not null;

drop index if exists artist_profiles_profile_id_login_uidx;
create unique index artist_profiles_profile_id_login_uidx
  on public.artist_profiles (profile_id)
  where profile_id is not null;

comment on column public.artist_profiles.user_id is
  'Login artist FK to profiles.id (= auth.uid()). NULL for label-managed roster artists (no auth user).';
comment on column public.artist_profiles.profile_id is
  'Canonical login FK; equals user_id for login artists. NULL for managed roster artists.';
comment on column public.artist_profiles.created_by_label_profile_id is
  'Label that created this managed roster artist_profiles row. Never converts Label account_type.';

-- Sync trigger: allow both user_id and profile_id to remain NULL for roster artists
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
    -- Only mirror when one side is set; both may be NULL for managed roster
    if new.profile_id is null and new.user_id is not null then
      new.profile_id := new.user_id;
    end if;
    if new.user_id is null and new.profile_id is not null then
      new.user_id := new.profile_id;
    end if;
    return new;
  end if;

  if new.artist_name is distinct from old.artist_name then
    new.stage_name := new.artist_name;
  elsif new.stage_name is distinct from old.stage_name then
    new.artist_name := new.stage_name;
  end if;

  if new.profile_id is distinct from old.profile_id and new.profile_id is not null then
    new.user_id := new.profile_id;
  elsif new.user_id is distinct from old.user_id and new.user_id is not null then
    new.profile_id := new.user_id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- label_roster_artists join (preferred so roster exists without converting Label→Artist)
-- ---------------------------------------------------------------------------
create table if not exists public.label_roster_artists (
  id uuid primary key default gen_random_uuid(),
  label_profile_id uuid not null references public.label_profiles (id) on delete cascade,
  artist_profile_id uuid not null references public.artist_profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (label_profile_id, artist_profile_id)
);

create index if not exists label_roster_artists_label_idx
  on public.label_roster_artists (label_profile_id);
create index if not exists label_roster_artists_artist_idx
  on public.label_roster_artists (artist_profile_id);

comment on table public.label_roster_artists is
  'Label-managed roster membership. Does not grant artist role to the label user.';

-- ---------------------------------------------------------------------------
-- C) release_contributors: optional IPI/ISNI (share_percent remains metadata only)
-- ---------------------------------------------------------------------------
alter table public.release_contributors
  add column if not exists ipi_cae text,
  add column if not exists isni text;

comment on column public.release_contributors.share_percent is
  'Optional ownership/share metadata only. NOT a DDEX DisplayArtistName Party percentage. Do not map to DisplayArtist %.';
comment on column public.release_contributors.ipi_cae is
  'Optional IPI/CAE identifier for future DDEX Party mapping.';
comment on column public.release_contributors.isni is
  'Optional ISNI for future DDEX Party mapping.';

-- ---------------------------------------------------------------------------
-- D) release_assets tech metadata
-- ---------------------------------------------------------------------------
alter table public.release_assets
  add column if not exists codec text,
  add column if not exists container text,
  add column if not exists sample_rate_hz int,
  add column if not exists bit_depth int,
  add column if not exists channels int,
  add column if not exists duration_ms int,
  add column if not exists hash_algorithm text;

comment on column public.release_assets.hash_algorithm is
  'Checksum algorithm for checksum column (e.g. sha256). Never invent values.';

-- ---------------------------------------------------------------------------
-- E) release_deals + ddex_messages (no XML generation)
-- ---------------------------------------------------------------------------
create table if not exists public.release_deals (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  territories text[] not null default array['WW']::text[],
  use_types text[] not null default array['OnDemandStream','PermanentDownload']::text[],
  commercial_model_types text[] not null default array['SubscriptionModel','PayAsYouGoModel']::text[],
  validity_start date,
  validity_end date,
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists release_deals_release_idx on public.release_deals (release_id);

comment on table public.release_deals is
  'Commercial deal / territory foundation for future ERN DealList. No XML generated here.';

create table if not exists public.ddex_messages (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  message_id text not null,
  recipient_config_key text not null default '',
  message_type text not null default 'NewReleaseMessage',
  ern_version text not null default '4.3.2',
  validation_status text not null default 'pending',
  delivery_status text not null default 'pending',
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  delivered_at timestamptz,
  xml_storage_path text,
  error text,
  retry_count int not null default 0,
  constraint ddex_messages_xml_path_null_ok check (true)
);

create index if not exists ddex_messages_release_idx on public.ddex_messages (release_id, created_at desc);
create unique index if not exists ddex_messages_message_id_uidx on public.ddex_messages (message_id);

comment on table public.ddex_messages is
  'Ops ledger for future DDEX deliveries. xml_storage_path intentionally unused until ERN generation exists. Staff only.';
comment on column public.ddex_messages.xml_storage_path is
  'Reserved for future ERN XML storage. Always null in this foundation — no XML generation.';

-- ---------------------------------------------------------------------------
-- Helpers for roster RLS
-- ---------------------------------------------------------------------------
create or replace function public.label_owns_profile(p_label_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.label_profiles lp
    where lp.id = p_label_profile_id
      and lp.user_id = auth.uid()
  );
$$;

create or replace function public.label_manages_artist(p_artist_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.label_roster_artists lra
    join public.label_profiles lp on lp.id = lra.label_profile_id
    where lra.artist_profile_id = p_artist_profile_id
      and lp.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.artist_profiles ap
    join public.label_profiles lp on lp.id = ap.created_by_label_profile_id
    where ap.id = p_artist_profile_id
      and lp.user_id = auth.uid()
  );
$$;

revoke all on function public.label_owns_profile(uuid) from public;
grant execute on function public.label_owns_profile(uuid) to authenticated;
revoke all on function public.label_manages_artist(uuid) from public;
grant execute on function public.label_manages_artist(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: label_roster_artists
-- ---------------------------------------------------------------------------
alter table public.label_roster_artists enable row level security;

drop policy if exists "label_roster_select" on public.label_roster_artists;
create policy "label_roster_select" on public.label_roster_artists
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or public.label_owns_profile(label_profile_id)
  );

drop policy if exists "label_roster_insert" on public.label_roster_artists;
create policy "label_roster_insert" on public.label_roster_artists
  for insert to authenticated
  with check (
    public.label_owns_profile(label_profile_id)
    and created_by = auth.uid()
  );

drop policy if exists "label_roster_update" on public.label_roster_artists;
create policy "label_roster_update" on public.label_roster_artists
  for update to authenticated
  using (public.label_owns_profile(label_profile_id))
  with check (public.label_owns_profile(label_profile_id));

drop policy if exists "label_roster_delete" on public.label_roster_artists;
create policy "label_roster_delete" on public.label_roster_artists
  for delete to authenticated
  using (public.label_owns_profile(label_profile_id));

-- ---------------------------------------------------------------------------
-- RLS: artist_profiles — extend for label-managed roster (no cross-label)
-- ---------------------------------------------------------------------------
drop policy if exists "artist_profiles_select_own" on public.artist_profiles;
create policy "artist_profiles_select_own" on public.artist_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_staff(auth.uid())
    or public.label_manages_artist(id)
  );

drop policy if exists "artist_profiles_update_own" on public.artist_profiles;
create policy "artist_profiles_update_own" on public.artist_profiles
  for update to authenticated
  using (
    user_id = auth.uid()
    or public.label_manages_artist(id)
  )
  with check (
    (
      user_id = auth.uid()
      and user_id is not null
    )
    or (
      user_id is null
      and public.label_manages_artist(id)
    )
  );

drop policy if exists "artist_profiles_insert_roster" on public.artist_profiles;
create policy "artist_profiles_insert_roster" on public.artist_profiles
  for insert to authenticated
  with check (
    -- Managed roster only: no login user linkage; label must own created_by_label_profile_id
    user_id is null
    and profile_id is null
    and created_by_label_profile_id is not null
    and public.label_owns_profile(created_by_label_profile_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: release_deals (owner via release + staff)
-- ---------------------------------------------------------------------------
alter table public.release_deals enable row level security;

drop policy if exists "release_deals_select" on public.release_deals;
create policy "release_deals_select" on public.release_deals
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.releases r
      where r.id = release_id and r.owner_user_id = auth.uid()
    )
  );

drop policy if exists "release_deals_insert" on public.release_deals;
create policy "release_deals_insert" on public.release_deals
  for insert to authenticated
  with check (
    exists (
      select 1 from public.releases r
      where r.id = release_id and r.owner_user_id = auth.uid()
    )
  );

drop policy if exists "release_deals_update" on public.release_deals;
create policy "release_deals_update" on public.release_deals
  for update to authenticated
  using (
    exists (
      select 1 from public.releases r
      where r.id = release_id and r.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.releases r
      where r.id = release_id and r.owner_user_id = auth.uid()
    )
  );

drop policy if exists "release_deals_delete" on public.release_deals;
create policy "release_deals_delete" on public.release_deals
  for delete to authenticated
  using (
    exists (
      select 1 from public.releases r
      where r.id = release_id and r.owner_user_id = auth.uid()
    )
  );

drop policy if exists "release_deals_staff_all" on public.release_deals;
create policy "release_deals_staff_all" on public.release_deals
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS: ddex_messages — staff only
-- ---------------------------------------------------------------------------
alter table public.ddex_messages enable row level security;

drop policy if exists "ddex_messages_staff_select" on public.ddex_messages;
create policy "ddex_messages_staff_select" on public.ddex_messages
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "ddex_messages_staff_write" on public.ddex_messages;
create policy "ddex_messages_staff_write" on public.ddex_messages
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));
