-- NEXO fanlink expansion: deterministic artist/song slug, cached resolution, 30s preview metadata.
alter table public.fanlinks add column if not exists artist_slug text;
alter table public.fanlinks add column if not exists song_slug text;
alter table public.fanlinks add column if not exists track_id uuid references public.release_tracks(id) on delete set null;
alter table public.fanlinks add column if not exists preview_storage_bucket text;
alter table public.fanlinks add column if not exists preview_storage_path text;
alter table public.fanlinks add column if not exists preview_seconds integer not null default 30 check (preview_seconds between 1 and 30);
alter table public.fanlinks add column if not exists resolved_at timestamptz;
alter table public.fanlinks add column if not exists last_refresh_at timestamptz;
alter table public.fanlinks add column if not exists resolution_status text not null default 'pending' check (resolution_status in ('pending','resolved','partial','failed'));
create unique index if not exists fanlinks_artist_song_slug_idx on public.fanlinks(artist_slug,song_slug) where artist_slug is not null and song_slug is not null;
create index if not exists fanlinks_release_idx on public.fanlinks(release_id);
create index if not exists fanlinks_isrc_idx on public.fanlinks(isrc);
