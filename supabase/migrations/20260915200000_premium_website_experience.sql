-- Premium Website Experience — additive only.
-- Nexo-owned HTML5 player is primary playback; DSP URLs are outbound links.
-- Never reset DB / rewrite migration history.

-- ---------------------------------------------------------------------------
-- Artist public fields (bio admin): genres + country on artist_profiles
-- ---------------------------------------------------------------------------
alter table public.artist_profiles
  add column if not exists genres text[] not null default '{}'::text[],
  add column if not exists country text;

comment on column public.artist_profiles.genres is
  'Public-facing genre tags for website artist pages. Empty when unset.';
comment on column public.artist_profiles.country is
  'Optional public country/region display for website artist pages.';

-- ---------------------------------------------------------------------------
-- Website settings (homepage hero / section visibility — jsonb)
-- ---------------------------------------------------------------------------
create table if not exists public.website_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint website_settings_key_len check (char_length(key) between 1 and 100)
);

drop trigger if exists website_settings_set_updated_at on public.website_settings;
create trigger website_settings_set_updated_at
  before update on public.website_settings
  for each row execute function public.set_updated_at();

alter table public.website_settings enable row level security;

drop policy if exists "website_settings_public_select" on public.website_settings;
create policy "website_settings_public_select" on public.website_settings
  for select
  using (true);

drop policy if exists "website_settings_staff_all" on public.website_settings;
create policy "website_settings_staff_all" on public.website_settings
  for all
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

insert into public.website_settings (key, value)
values (
  'homepage',
  jsonb_build_object(
    'hero_eyebrow', 'Global Music Distribution & Publishing',
    'hero_title', 'Your Music.',
    'hero_title_accent', 'Everywhere.',
    'hero_body', 'NEXO Music Distribution helps independent artists and labels deliver releases to 450+ platforms, manage royalties with clarity, and unlock publishing opportunities through Nexo Publishing Group.',
    'hero_cta_label', 'Get Started',
    'hero_cta_href', '/get-started',
    'hero_image_url', null,
    'show_featured_artists', true,
    'show_featured_releases', true,
    'show_partners', true,
    'show_services', true,
    'show_about', true,
    'section_order', jsonb_build_array(
      'hero', 'trust', 'partners', 'featured_releases', 'featured_artists',
      'features', 'platform', 'artists', 'labels', 'publishing', 'workflow', 'qc', 'reach', 'stats', 'cta'
    )
  )
)
on conflict (key) do nothing;

comment on table public.website_settings is
  'Public website configuration (homepage hero/sections). Staff write; public read.';

-- ---------------------------------------------------------------------------
-- Website videos (external hosts labeled; never downloaded)
-- ---------------------------------------------------------------------------
create table if not exists public.website_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  thumbnail_url text,
  artist_id uuid references public.artist_profiles (id) on delete set null,
  release_id uuid references public.releases (id) on delete set null,
  track_id uuid references public.release_tracks (id) on delete set null,
  published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_videos_title_len check (char_length(title) between 1 and 300),
  constraint website_videos_url_len check (char_length(url) between 8 and 2000)
);

create index if not exists website_videos_published_idx
  on public.website_videos (published, sort_order)
  where published = true;

create index if not exists website_videos_artist_idx
  on public.website_videos (artist_id)
  where artist_id is not null;

create index if not exists website_videos_release_idx
  on public.website_videos (release_id)
  where release_id is not null;

drop trigger if exists website_videos_set_updated_at on public.website_videos;
create trigger website_videos_set_updated_at
  before update on public.website_videos
  for each row execute function public.set_updated_at();

alter table public.website_videos enable row level security;

drop policy if exists "website_videos_public_select" on public.website_videos;
create policy "website_videos_public_select" on public.website_videos
  for select
  using (published = true or public.is_staff(auth.uid()));

drop policy if exists "website_videos_staff_all" on public.website_videos;
create policy "website_videos_staff_all" on public.website_videos
  for all
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

comment on table public.website_videos is
  'External music videos shown in Nexo chrome. URLs are outbound/external sources — not hosted by Nexo.';

-- ---------------------------------------------------------------------------
-- Clarify playback comments (Nexo player primary)
-- ---------------------------------------------------------------------------
comment on column public.releases.website_playback_enabled is
  'When true AND website_published, Nexo may stream short-lived signed URLs from release-audio. DSP links remain outbound only.';

comment on column public.release_tracks.website_preview_enabled is
  'When true (and release playback eligible), this track may be offered in the Nexo player queue.';

-- ---------------------------------------------------------------------------
-- Extend admin_set_artist_website with bio/image/genres/country/socials
-- ---------------------------------------------------------------------------
drop function if exists public.admin_set_artist_website(uuid, boolean, boolean, text, text, text, jsonb, jsonb, int);

create or replace function public.admin_set_artist_website(
  p_artist_profile_id uuid,
  p_published boolean default null,
  p_featured boolean default null,
  p_slug text default null,
  p_tagline text default null,
  p_bio_html text default null,
  p_bio_json jsonb default null,
  p_social_links jsonb default null,
  p_sort_order int default null,
  p_artist_name text default null,
  p_genres text[] default null,
  p_country text default null,
  p_avatar_url text default null,
  p_cover_url text default null
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
    artist_name = coalesce(nullif(trim(p_artist_name), ''), artist_name),
    genres = coalesce(p_genres, genres),
    country = case when p_country is null then country else nullif(trim(p_country), '') end,
    avatar_url = case when p_avatar_url is null then avatar_url else nullif(trim(p_avatar_url), '') end,
    cover_url = case when p_cover_url is null then cover_url else nullif(trim(p_cover_url), '') end,
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
    jsonb_build_object(
      'website_published', a.website_published,
      'public_slug', a.public_slug,
      'featured', a.website_featured
    )
  );

  return a;
end;
$$;

revoke all on function public.admin_set_artist_website(
  uuid, boolean, boolean, text, text, text, jsonb, jsonb, int, text, text[], text, text, text
) from public;
grant execute on function public.admin_set_artist_website(
  uuid, boolean, boolean, text, text, text, jsonb, jsonb, int, text, text[], text, text, text
) to authenticated;

-- Keep older 9-arg overload usable if PostgREST still maps it — drop if present after replace.
-- (create or replace with more defaults replaces by signature; leave a thin wrapper)

create or replace function public.admin_upsert_website_setting(
  p_key text,
  p_value jsonb
)
returns public.website_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row public.website_settings;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  if p_key is null or length(trim(p_key)) < 1 then
    raise exception 'Invalid key' using errcode = '22023';
  end if;

  insert into public.website_settings (key, value, updated_by)
  values (trim(p_key), coalesce(p_value, '{}'::jsonb), actor)
  on conflict (key) do update set
    value = excluded.value,
    updated_by = actor,
    updated_at = now()
  returning * into row;

  perform public.write_audit_log(
    'website_publish'::public.audit_action,
    'website_settings',
    null,
    jsonb_build_object('key', row.key)
  );

  return row;
end;
$$;

revoke all on function public.admin_upsert_website_setting(text, jsonb) from public;
grant execute on function public.admin_upsert_website_setting(text, jsonb) to authenticated;

create or replace function public.admin_upsert_website_video(
  p_id uuid default null,
  p_title text default null,
  p_url text default null,
  p_thumbnail_url text default null,
  p_artist_id uuid default null,
  p_release_id uuid default null,
  p_track_id uuid default null,
  p_published boolean default null,
  p_sort_order int default null,
  p_delete boolean default false
)
returns public.website_videos
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  row public.website_videos;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  if p_delete and p_id is not null then
    delete from public.website_videos where id = p_id returning * into row;
    return row;
  end if;

  if p_id is null then
    if nullif(trim(coalesce(p_title, '')), '') is null or nullif(trim(coalesce(p_url, '')), '') is null then
      raise exception 'title and url required' using errcode = '22023';
    end if;
    insert into public.website_videos (
      title, url, thumbnail_url, artist_id, release_id, track_id, published, sort_order
    ) values (
      trim(p_title),
      trim(p_url),
      nullif(trim(coalesce(p_thumbnail_url, '')), ''),
      p_artist_id,
      p_release_id,
      p_track_id,
      coalesce(p_published, false),
      coalesce(p_sort_order, 0)
    )
    returning * into row;
  else
    update public.website_videos set
      title = coalesce(nullif(trim(p_title), ''), title),
      url = coalesce(nullif(trim(p_url), ''), url),
      thumbnail_url = case when p_thumbnail_url is null then thumbnail_url else nullif(trim(p_thumbnail_url), '') end,
      artist_id = coalesce(p_artist_id, artist_id),
      release_id = coalesce(p_release_id, release_id),
      track_id = coalesce(p_track_id, track_id),
      published = coalesce(p_published, published),
      sort_order = coalesce(p_sort_order, sort_order),
      updated_at = now()
    where id = p_id
    returning * into row;
    if not found then
      raise exception 'Video not found' using errcode = 'P0002';
    end if;
  end if;

  return row;
end;
$$;

revoke all on function public.admin_upsert_website_video(
  uuid, text, text, text, uuid, uuid, uuid, boolean, int, boolean
) from public;
grant execute on function public.admin_upsert_website_video(
  uuid, text, text, text, uuid, uuid, uuid, boolean, int, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: public published content only (RLS still filters rows)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.releases;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.artist_profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.website_partners;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.website_videos;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.website_settings;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.cms_pages;
  exception when duplicate_object then null;
  end;
end;
$$;

-- Public credits for published releases (credits section on /release/[slug])
drop policy if exists "release_contributors_website_public_select" on public.release_contributors;
create policy "release_contributors_website_public_select" on public.release_contributors
  for select
  using (
    exists (
      select 1 from public.releases r
      where r.id = release_id and r.website_published = true
    )
    or public.is_staff(auth.uid())
  );
