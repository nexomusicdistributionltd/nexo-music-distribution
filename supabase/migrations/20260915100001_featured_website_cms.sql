-- Featured website CMS + public catalog fields + Move In Catalog extensions
-- Additive only. Never invent LIVE/DELIVERED/PAID. Never hard-delete catalog migrations.

-- ---------------------------------------------------------------------------
-- Releases: website / public catalog controls
-- ---------------------------------------------------------------------------
alter table public.releases
  add column if not exists website_published boolean not null default false,
  add column if not exists website_featured boolean not null default false,
  add column if not exists website_published_at timestamptz,
  add column if not exists website_slug text,
  add column if not exists website_blurb text,
  add column if not exists website_sort_order int not null default 0,
  add column if not exists website_playback_enabled boolean not null default false,
  add column if not exists website_embed_spotify_url text,
  add column if not exists website_embed_apple_url text,
  add column if not exists website_embed_youtube_url text,
  add column if not exists website_cover_override_url text;

create unique index if not exists releases_website_slug_uidx
  on public.releases (website_slug)
  where website_slug is not null and website_published = true;

create index if not exists releases_website_published_idx
  on public.releases (website_published, website_featured, website_sort_order)
  where website_published = true;

comment on column public.releases.website_published is
  'Admin-controlled public catalog visibility. Does not invent LIVE status.';
comment on column public.releases.website_playback_enabled is
  'When true AND website_published, optional signed-URL preview may be offered. DSP embeds preferred.';

-- ---------------------------------------------------------------------------
-- Tracks: optional preview flag (never invents streaming rights)
-- ---------------------------------------------------------------------------
alter table public.release_tracks
  add column if not exists website_preview_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- Artist profiles: public bio / slug
-- ---------------------------------------------------------------------------
alter table public.artist_profiles
  add column if not exists public_slug text,
  add column if not exists public_tagline text,
  add column if not exists public_bio_html text,
  add column if not exists public_bio_json jsonb not null default '{}'::jsonb,
  add column if not exists website_published boolean not null default false,
  add column if not exists website_featured boolean not null default false,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists website_sort_order int not null default 0;

create unique index if not exists artist_profiles_public_slug_uidx
  on public.artist_profiles (public_slug)
  where public_slug is not null;

create index if not exists artist_profiles_website_published_idx
  on public.artist_profiles (website_published, website_featured)
  where website_published = true;

-- ---------------------------------------------------------------------------
-- Partners (logo marquee)
-- ---------------------------------------------------------------------------
create table if not exists public.website_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  logo_url text,
  logo_storage_path text,
  website_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_partners_name_len check (char_length(name) between 1 and 200)
);

create index if not exists website_partners_active_idx
  on public.website_partners (is_active, sort_order)
  where is_active = true;

drop trigger if exists website_partners_set_updated_at on public.website_partners;
create trigger website_partners_set_updated_at
  before update on public.website_partners
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Blog
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.blog_post_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  excerpt text,
  cover_image_url text,
  body_html text not null default '',
  body_json jsonb not null default '{}'::jsonb,
  status public.blog_post_status not null default 'draft',
  published_at timestamptz,
  author_user_id uuid references public.profiles (id) on delete set null,
  seo_title text,
  seo_description text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_slug_len check (char_length(slug) between 1 and 200),
  constraint blog_posts_title_len check (char_length(title) between 1 and 300)
);

create unique index if not exists blog_posts_slug_uidx on public.blog_posts (slug);
create index if not exists blog_posts_published_idx
  on public.blog_posts (status, published_at desc)
  where status = 'published';

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- CMS pages (legal + custom)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.cms_page_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  body_html text not null default '',
  body_json jsonb not null default '{}'::jsonb,
  status public.cms_page_status not null default 'draft',
  published_at timestamptz,
  page_kind text not null default 'custom'
    check (page_kind in ('custom', 'privacy', 'terms', 'cookies', 'legal')),
  seo_title text,
  seo_description text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_pages_slug_len check (char_length(slug) between 1 and 200)
);

create unique index if not exists cms_pages_slug_uidx on public.cms_pages (slug);
create index if not exists cms_pages_published_idx
  on public.cms_pages (status, page_kind)
  where status = 'published';

drop trigger if exists cms_pages_set_updated_at on public.cms_pages;
create trigger cms_pages_set_updated_at
  before update on public.cms_pages
  for each row execute function public.set_updated_at();

-- Seed legal page shells (draft until staff publish) — idempotent
insert into public.cms_pages (slug, title, page_kind, status, body_html)
select v.slug, v.title, v.page_kind, 'draft'::public.cms_page_status, v.body_html
from (values
  ('privacy', 'Privacy Policy', 'privacy',
   '<p>Privacy Policy content will be published by NEXO MUSIC DISTRIBUTION LTD.</p>'),
  ('terms', 'Terms of Service', 'terms',
   '<p>Terms of Service content will be published by NEXO MUSIC DISTRIBUTION LTD.</p>'),
  ('cookies', 'Cookie Policy', 'cookies',
   '<p>Cookie Policy content will be published by NEXO MUSIC DISTRIBUTION LTD.</p>')
) as v(slug, title, page_kind, body_html)
where not exists (select 1 from public.cms_pages p where p.slug = v.slug);

-- ---------------------------------------------------------------------------
-- CMS media registry
-- ---------------------------------------------------------------------------
create table if not exists public.cms_media (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null default 'cms-media',
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint,
  alt_text text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists cms_media_created_idx on public.cms_media (created_at desc);

-- ---------------------------------------------------------------------------
-- Move In Catalog fields on catalog_migrations (extend Batch 6 — no second system)
-- ---------------------------------------------------------------------------
alter table public.catalog_migrations
  add column if not exists previous_distributor text,
  add column if not exists import_method text not null default 'unconfigured'
    check (import_method in (
      'unconfigured', 'external_api', 'artist_json', 'artist_csv', 'manual'
    )),
  add column if not exists workflow_step text not null default 'search'
    check (workflow_step in (
      'search', 'select', 'review', 'move_in', 'done'
    )),
  add column if not exists artist_notes text,
  add column if not exists metadata_gaps jsonb not null default '[]'::jsonb,
  add column if not exists last_job_status text,
  add column if not exists last_job_message text,
  add column if not exists last_job_at timestamptz;

alter table public.catalog_migration_items
  add column if not exists selected boolean not null default false,
  add column if not exists metadata_gaps jsonb not null default '[]'::jsonb,
  add column if not exists previous_distributor text,
  add column if not exists import_payload jsonb not null default '{}'::jsonb,
  add column if not exists draft_release_id uuid references public.releases (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Storage: cms-media (public read for published assets; staff write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cms-media',
  'cms-media',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cms_media_public_read" on storage.objects;
create policy "cms_media_public_read" on storage.objects
  for select to public
  using (bucket_id = 'cms-media');

drop policy if exists "cms_media_staff_insert" on storage.objects;
create policy "cms_media_staff_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cms-media'
    and public.is_staff(auth.uid())
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "cms_media_staff_update" on storage.objects;
create policy "cms_media_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'cms-media' and public.is_staff(auth.uid()))
  with check (bucket_id = 'cms-media' and public.is_staff(auth.uid()));

drop policy if exists "cms_media_staff_delete" on storage.objects;
create policy "cms_media_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cms-media' and public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.website_partners enable row level security;
alter table public.blog_posts enable row level security;
alter table public.cms_pages enable row level security;
alter table public.cms_media enable row level security;

-- Partners: public read active; staff write
drop policy if exists "website_partners_public_select" on public.website_partners;
create policy "website_partners_public_select" on public.website_partners
  for select to anon, authenticated
  using (is_active = true or public.is_staff(auth.uid()));

drop policy if exists "website_partners_staff_all" on public.website_partners;
create policy "website_partners_staff_all" on public.website_partners
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Blog: public read published; staff all
drop policy if exists "blog_posts_public_select" on public.blog_posts;
create policy "blog_posts_public_select" on public.blog_posts
  for select to anon, authenticated
  using (status = 'published' or public.is_staff(auth.uid()));

drop policy if exists "blog_posts_staff_all" on public.blog_posts;
create policy "blog_posts_staff_all" on public.blog_posts
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- CMS pages
drop policy if exists "cms_pages_public_select" on public.cms_pages;
create policy "cms_pages_public_select" on public.cms_pages
  for select to anon, authenticated
  using (status = 'published' or public.is_staff(auth.uid()));

drop policy if exists "cms_pages_staff_all" on public.cms_pages;
create policy "cms_pages_staff_all" on public.cms_pages
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- CMS media registry
drop policy if exists "cms_media_public_select" on public.cms_media;
create policy "cms_media_public_select" on public.cms_media
  for select to anon, authenticated
  using (true);

drop policy if exists "cms_media_staff_all" on public.cms_media;
create policy "cms_media_staff_all" on public.cms_media
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Public read for published releases (website fields only via select — full row ok for marketing)
drop policy if exists "releases_website_public_select" on public.releases;
create policy "releases_website_public_select" on public.releases
  for select to anon, authenticated
  using (website_published = true);

drop policy if exists "release_tracks_website_public_select" on public.release_tracks;
create policy "release_tracks_website_public_select" on public.release_tracks
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.releases r
      where r.id = release_id and r.website_published = true
    )
  );

drop policy if exists "release_assets_website_public_select" on public.release_assets;
create policy "release_assets_website_public_select" on public.release_assets
  for select to anon, authenticated
  using (
    kind = 'artwork'
    and exists (
      select 1 from public.releases r
      where r.id = release_id and r.website_published = true
    )
  );

drop policy if exists "artist_profiles_website_public_select" on public.artist_profiles;
create policy "artist_profiles_website_public_select" on public.artist_profiles
  for select to anon, authenticated
  using (website_published = true or user_id = auth.uid() or public.is_staff(auth.uid()));

-- Owner write on own migrations (extend Batch 6 select with insert/update for owners)
drop policy if exists "catalog_migrations_owner_insert" on public.catalog_migrations;
create policy "catalog_migrations_owner_insert" on public.catalog_migrations
  for insert to authenticated
  with check (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists "catalog_migrations_owner_update" on public.catalog_migrations;
create policy "catalog_migrations_owner_update" on public.catalog_migrations
  for update to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists "catalog_migration_items_owner_write" on public.catalog_migration_items;
create policy "catalog_migration_items_owner_write" on public.catalog_migration_items
  for all to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.catalog_migrations m
      where m.id = migration_id and m.owner_user_id = auth.uid()
    )
  )
  with check (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.catalog_migrations m
      where m.id = migration_id and m.owner_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Helper: public catalog eligibility (truthful — never invents LIVE)
-- ---------------------------------------------------------------------------
create or replace function public.is_website_release_eligible(r public.releases)
returns boolean
language sql
immutable
as $$
  select coalesce(r.website_published, false) = true;
$$;

comment on function public.is_website_release_eligible(public.releases) is
  'Public catalog eligibility is admin website_published only. Status badges remain truthful.';

-- ---------------------------------------------------------------------------
-- RPCs — staff website controls
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_release_website(
  p_release_id uuid,
  p_published boolean default null,
  p_featured boolean default null,
  p_slug text default null,
  p_blurb text default null,
  p_sort_order int default null,
  p_playback_enabled boolean default null,
  p_embed_spotify text default null,
  p_embed_apple text default null,
  p_embed_youtube text default null
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.releases;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  update public.releases set
    website_published = coalesce(p_published, website_published),
    website_featured = coalesce(p_featured, website_featured),
    website_slug = case
      when p_slug is null then website_slug
      when nullif(trim(p_slug), '') is null then null
      else lower(regexp_replace(trim(p_slug), '[^a-z0-9-]+', '-', 'gi'))
    end,
    website_blurb = coalesce(p_blurb, website_blurb),
    website_sort_order = coalesce(p_sort_order, website_sort_order),
    website_playback_enabled = coalesce(p_playback_enabled, website_playback_enabled),
    website_embed_spotify_url = coalesce(p_embed_spotify, website_embed_spotify_url),
    website_embed_apple_url = coalesce(p_embed_apple, website_embed_apple_url),
    website_embed_youtube_url = coalesce(p_embed_youtube, website_embed_youtube_url),
    website_published_at = case
      when coalesce(p_published, website_published) = true
        and website_published_at is null then now()
      when coalesce(p_published, website_published) = false then null
      else website_published_at
    end,
    updated_at = now()
  where id = r.id
  returning * into r;

  perform public.write_audit_log(
    case when r.website_published then 'website_publish'::public.audit_action
         else 'website_unpublish'::public.audit_action end,
    'release',
    r.id,
    jsonb_build_object(
      'website_published', r.website_published,
      'website_featured', r.website_featured,
      'website_slug', r.website_slug
    )
  );

  return r;
end;
$$;

revoke all on function public.admin_set_release_website(uuid, boolean, boolean, text, text, int, boolean, text, text, text) from public;
grant execute on function public.admin_set_release_website(uuid, boolean, boolean, text, text, int, boolean, text, text, text) to authenticated;

create or replace function public.admin_set_artist_website(
  p_artist_profile_id uuid,
  p_published boolean default null,
  p_featured boolean default null,
  p_slug text default null,
  p_tagline text default null,
  p_bio_html text default null,
  p_bio_json jsonb default null,
  p_social_links jsonb default null,
  p_sort_order int default null
)
returns public.artist_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  a public.artist_profiles;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  update public.artist_profiles set
    website_published = coalesce(p_published, website_published),
    website_featured = coalesce(p_featured, website_featured),
    public_slug = case
      when p_slug is null then public_slug
      when nullif(trim(p_slug), '') is null then null
      else lower(regexp_replace(trim(p_slug), '[^a-z0-9-]+', '-', 'gi'))
    end,
    public_tagline = coalesce(p_tagline, public_tagline),
    public_bio_html = coalesce(p_bio_html, public_bio_html),
    public_bio_json = coalesce(p_bio_json, public_bio_json),
    social_links = coalesce(p_social_links, social_links),
    website_sort_order = coalesce(p_sort_order, website_sort_order),
    updated_at = now()
  where id = p_artist_profile_id
  returning * into a;

  if not found then
    raise exception 'Artist not found' using errcode = 'P0002';
  end if;

  perform public.write_audit_log(
    'website_publish'::public.audit_action,
    'artist_profile',
    a.id,
    jsonb_build_object('website_published', a.website_published, 'public_slug', a.public_slug)
  );

  return a;
end;
$$;

revoke all on function public.admin_set_artist_website(uuid, boolean, boolean, text, text, text, jsonb, jsonb, int) from public;
grant execute on function public.admin_set_artist_website(uuid, boolean, boolean, text, text, text, jsonb, jsonb, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Artist-facing Move In Catalog RPCs (extends Batch 6 — no second release DB)
-- ---------------------------------------------------------------------------
create or replace function public.create_own_catalog_migration(
  p_title text default null,
  p_previous_distributor text default null,
  p_import_method text default 'manual',
  p_notes text default null
)
returns public.catalog_migrations
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  ap_id uuid;
  m public.catalog_migrations;
  method text := coalesce(nullif(trim(p_import_method), ''), 'manual');
begin
  if actor is null then
    raise exception 'Auth required' using errcode = '42501';
  end if;

  if method not in ('unconfigured', 'external_api', 'artist_json', 'artist_csv', 'manual') then
    raise exception 'Invalid import_method' using errcode = 'P0001';
  end if;

  select id into ap_id from public.artist_profiles where user_id = actor limit 1;

  insert into public.catalog_migrations (
    owner_user_id, artist_profile_id, source_name, source_connected, status,
    title, notes, previous_distributor, import_method, workflow_step,
    external_catalog_unavailable_reason, created_by, last_job_status, last_job_message, last_job_at
  ) values (
    actor,
    ap_id,
    case when method = 'external_api' then 'external_api' else method end,
    false,
    'draft',
    p_title,
    p_notes,
    nullif(trim(coalesce(p_previous_distributor, '')), ''),
    method,
    'search',
    case when method = 'external_api' then
      'External catalog API not connected. Use artist-provided JSON/CSV/manual metadata instead.'
    else null end,
    actor,
    'created',
    'Migration draft created.',
    now()
  )
  returning * into m;

  perform public.write_audit_log(
    'catalog_migration'::public.audit_action,
    'catalog_migration',
    m.id,
    jsonb_build_object('import_method', m.import_method, 'workflow_step', m.workflow_step)
  );

  return m;
end;
$$;

revoke all on function public.create_own_catalog_migration(text, text, text, text) from public;
grant execute on function public.create_own_catalog_migration(text, text, text, text) to authenticated;

create or replace function public.import_own_catalog_migration_items(
  p_migration_id uuid,
  p_items jsonb
)
returns public.catalog_migrations
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  m public.catalog_migrations;
  item jsonb;
  gaps jsonb;
  upc_val text;
  isrcs text[];
  cnt int := 0;
begin
  if actor is null then
    raise exception 'Auth required' using errcode = '42501';
  end if;

  select * into m from public.catalog_migrations
  where id = p_migration_id for update;
  if not found then
    raise exception 'Migration not found' using errcode = 'P0002';
  end if;
  if m.owner_user_id <> actor and not public.is_staff(actor) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if m.status in ('completed', 'cancelled') then
    raise exception 'Migration is closed' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be a JSON array' using errcode = 'P0001';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    gaps := '[]'::jsonb;
    upc_val := nullif(trim(coalesce(item->>'upc', item->>'external_upc', '')), '');
    isrcs := coalesce(
      (select array_agg(upper(trim(x))) from jsonb_array_elements_text(coalesce(item->'isrcs', '[]'::jsonb)) t(x)
        where length(trim(x)) > 0),
      '{}'::text[]
    );

    if nullif(trim(coalesce(item->>'title', '')), '') is null then
      gaps := gaps || '["missing_title"]'::jsonb;
    end if;
    if upc_val is null then
      gaps := gaps || '["missing_upc"]'::jsonb;
    end if;
    if coalesce(array_length(isrcs, 1), 0) = 0 then
      gaps := gaps || '["missing_isrc"]'::jsonb;
    end if;
    -- Never invent identifiers — leave nulls as gaps

    insert into public.catalog_migration_items (
      migration_id, external_release_id, external_title, external_artist_name,
      external_upc, external_isrcs, external_track_count, external_payload,
      status, selected, metadata_gaps, previous_distributor, import_payload,
      isrc_preserved, upc_preserved
    ) values (
      m.id,
      nullif(trim(coalesce(item->>'external_release_id', item->>'id', '')), ''),
      nullif(trim(coalesce(item->>'title', '')), ''),
      nullif(trim(coalesce(item->>'artist_name', item->>'artistName', '')), ''),
      upc_val,
      isrcs,
      nullif(item->>'track_count', '')::int,
      coalesce(item, '{}'::jsonb),
      'pending',
      coalesce((item->>'selected')::boolean, true),
      gaps,
      nullif(trim(coalesce(item->>'previous_distributor', m.previous_distributor, '')), ''),
      coalesce(item, '{}'::jsonb),
      coalesce(array_length(isrcs, 1), 0) > 0,
      upc_val is not null
    );
    cnt := cnt + 1;
  end loop;

  update public.catalog_migrations set
    item_count = item_count + cnt,
    workflow_step = case when cnt > 0 then 'select' else workflow_step end,
    status = 'review',
    last_job_status = 'items_imported',
    last_job_message = format('Imported %s artist-provided item(s). No identifiers were invented.', cnt),
    last_job_at = now(),
    updated_at = now()
  where id = m.id
  returning * into m;

  perform public.write_audit_log(
    'catalog_migration_import'::public.audit_action,
    'catalog_migration',
    m.id,
    jsonb_build_object('imported', cnt)
  );

  return m;
end;
$$;

revoke all on function public.import_own_catalog_migration_items(uuid, jsonb) from public;
grant execute on function public.import_own_catalog_migration_items(uuid, jsonb) to authenticated;

create or replace function public.set_own_catalog_migration_step(
  p_migration_id uuid,
  p_step text,
  p_selected_item_ids uuid[] default null
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
  if actor is null then
    raise exception 'Auth required' using errcode = '42501';
  end if;
  if p_step not in ('search', 'select', 'review', 'move_in', 'done') then
    raise exception 'Invalid step' using errcode = 'P0001';
  end if;

  select * into m from public.catalog_migrations where id = p_migration_id for update;
  if not found then
    raise exception 'Migration not found' using errcode = 'P0002';
  end if;
  if m.owner_user_id <> actor and not public.is_staff(actor) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if p_selected_item_ids is not null then
    update public.catalog_migration_items
    set selected = (id = any (p_selected_item_ids)), updated_at = now()
    where migration_id = m.id;
  end if;

  update public.catalog_migrations set
    workflow_step = p_step,
    last_job_status = 'step_' || p_step,
    last_job_message = 'Workflow advanced to ' || p_step,
    last_job_at = now(),
    updated_at = now()
  where id = m.id
  returning * into m;

  return m;
end;
$$;

revoke all on function public.set_own_catalog_migration_step(uuid, text, uuid[]) from public;
grant execute on function public.set_own_catalog_migration_step(uuid, text, uuid[]) to authenticated;

-- Move In: create draft releases from selected items (preserve ISRC/UPC; never invent)
create or replace function public.move_in_own_catalog_migration(
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
  it public.catalog_migration_items;
  new_release_id uuid;
  imported int := 0;
  skipped int := 0;
  conflicted int := 0;
  track_isrc text;
  dup_upc boolean;
  dup_isrc boolean;
begin
  if actor is null then
    raise exception 'Auth required' using errcode = '42501';
  end if;

  select * into m from public.catalog_migrations where id = p_migration_id for update;
  if not found then
    raise exception 'Migration not found' using errcode = 'P0002';
  end if;
  if m.owner_user_id <> actor and not public.is_staff(actor) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if m.status = 'completed' then
    raise exception 'Migration already completed' using errcode = 'P0001';
  end if;

  update public.catalog_migrations set
    status = 'importing',
    workflow_step = 'move_in',
    last_job_status = 'importing',
    last_job_message = 'Creating draft releases from selected items…',
    last_job_at = now(),
    updated_at = now()
  where id = m.id;

  for it in
    select * from public.catalog_migration_items
    where migration_id = m.id and selected = true and status not in ('imported', 'skipped')
    order by created_at
  loop
    dup_upc := false;
    dup_isrc := false;

    if it.external_upc is not null then
      select exists(
        select 1 from public.releases r
        where r.upc = it.external_upc and r.owner_user_id = m.owner_user_id
      ) into dup_upc;
    end if;

    if coalesce(array_length(it.external_isrcs, 1), 0) > 0 then
      select exists(
        select 1
        from public.release_tracks t
        join public.releases r on r.id = t.release_id
        where r.owner_user_id = m.owner_user_id
          and t.isrc = any (it.external_isrcs)
      ) into dup_isrc;
    end if;

    if dup_upc or dup_isrc then
      conflicted := conflicted + 1;
      update public.catalog_migration_items set
        status = 'conflict',
        conflict_reason = case
          when dup_upc and dup_isrc then 'duplicate_upc_and_isrc'
          when dup_upc then 'duplicate_upc'
          else 'duplicate_isrc'
        end,
        updated_at = now()
      where id = it.id;

      insert into public.catalog_migration_conflicts (
        migration_id, item_id, conflict_type, details, status
      ) values (
        m.id, it.id,
        case when dup_upc then 'duplicate_upc' else 'duplicate_isrc' end,
        jsonb_build_object('upc', it.external_upc, 'isrcs', to_jsonb(it.external_isrcs)),
        'open'
      );
      continue;
    end if;

    if it.external_title is null or length(trim(it.external_title)) = 0 then
      skipped := skipped + 1;
      update public.catalog_migration_items set
        status = 'skipped',
        notes = 'Skipped: missing title (will not invent metadata).',
        updated_at = now()
      where id = it.id;
      continue;
    end if;

    insert into public.releases (
      owner_user_id, artist_profile_id, title, primary_artist_name,
      upc, status, description
    ) values (
      m.owner_user_id,
      m.artist_profile_id,
      it.external_title,
      coalesce(it.external_artist_name, ''),
      it.external_upc, -- may be null — never invent
      'draft',
      case when m.previous_distributor is not null
        then 'Moved in from previous distributor: ' || m.previous_distributor
        else null end
    )
    returning id into new_release_id;

    -- Create a placeholder track when ISRCs provided (preserve only; no invented codes)
    if coalesce(array_length(it.external_isrcs, 1), 0) > 0 then
      track_isrc := it.external_isrcs[1];
      -- Only set if matches DB constraint format; else leave null (gap)
      if track_isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$' then
        insert into public.release_tracks (release_id, track_number, title, isrc)
        values (new_release_id, 1, it.external_title, track_isrc);
      else
        insert into public.release_tracks (release_id, track_number, title)
        values (new_release_id, 1, it.external_title);
      end if;
    else
      insert into public.release_tracks (release_id, track_number, title)
      values (new_release_id, 1, it.external_title);
    end if;

    update public.catalog_migration_items set
      status = 'imported',
      matched_release_id = new_release_id,
      draft_release_id = new_release_id,
      isrc_preserved = coalesce(array_length(it.external_isrcs, 1), 0) > 0,
      upc_preserved = it.external_upc is not null,
      updated_at = now()
    where id = it.id;

    imported := imported + 1;
  end loop;

  update public.catalog_migrations set
    status = case
      when conflicted > 0 and imported = 0 then 'failed'
      when imported > 0 then 'completed'
      else 'review'
    end,
    workflow_step = case when imported > 0 then 'done' else 'review' end,
    imported_count = imported_count + imported,
    conflict_count = conflict_count + conflicted,
    completed_at = case when imported > 0 then now() else completed_at end,
    last_job_status = case
      when imported > 0 then 'completed'
      when conflicted > 0 then 'conflicts'
      else 'no_items'
    end,
    last_job_message = format(
      'Move In finished: %s draft release(s) created, %s conflict(s), %s skipped. No LIVE/DELIVERED status invented.',
      imported, conflicted, skipped
    ),
    last_job_at = now(),
    updated_at = now()
  where id = m.id
  returning * into m;

  perform public.write_audit_log(
    'catalog_migration_move_in'::public.audit_action,
    'catalog_migration',
    m.id,
    jsonb_build_object('imported', imported, 'conflicts', conflicted, 'skipped', skipped)
  );

  return m;
end;
$$;

revoke all on function public.move_in_own_catalog_migration(uuid) from public;
grant execute on function public.move_in_own_catalog_migration(uuid) to authenticated;

comment on table public.website_partners is 'Partner logos for public marquee. Active partners only shown publicly.';
comment on table public.blog_posts is 'Marketing blog. Public select only when status=published.';
comment on table public.cms_pages is 'CMS pages including Privacy/Terms/Cookies. Public when published.';
comment on column public.catalog_migrations.previous_distributor is 'Artist-declared previous distributor for Move In Catalog.';
comment on column public.catalog_migrations.import_method is 'external_api only when credentials exist; otherwise artist_json/csv/manual.';
comment on column public.catalog_migrations.last_job_status is 'Real job status from Move In RPCs — never fake progress percentages.';
