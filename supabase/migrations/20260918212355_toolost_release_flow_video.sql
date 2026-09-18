-- TooLost-aligned release metadata + music video delivery workflow.
-- Additive migration: preserves existing audio releases and video requests.

alter type public.release_type add value if not exists 'compilation';

alter table public.release_tracks
  add column if not exists iswc text,
  add column if not exists liner_note text,
  add column if not exists tiktok_start_time text,
  add column if not exists clean_version boolean not null default false,
  add column if not exists instrumental boolean not null default false,
  add column if not exists ai_assisted boolean not null default false;

alter table public.music_video_submissions
  add column if not exists primary_artist_name text,
  add column if not exists label_name text,
  add column if not exists genre text,
  add column if not exists language text,
  add column if not exists release_date date,
  add column if not exists video_type text,
  add column if not exists age_restriction text,
  add column if not exists is_cover_version boolean not null default false,
  add column if not exists reference_upc text,
  add column if not exists reference_isrc text,
  add column if not exists deliver_apple_music boolean not null default true,
  add column if not exists deliver_vevo boolean not null default true,
  add column if not exists distribution_settings jsonb not null default '{}'::jsonb,
  add column if not exists provider_release_id text,
  add column if not exists provider_status text,
  add column if not exists provider_error text,
  add column if not exists provider_submitted_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.music_video_submissions
  drop constraint if exists music_video_submissions_status_check;

alter table public.music_video_submissions
  add constraint music_video_submissions_status_check
  check (status in (
    'submitted',
    'reviewing',
    'accepted',
    'provider_access_required',
    'provider_submitted',
    'live',
    'failed',
    'rejected'
  ));

create index if not exists music_video_provider_release_idx
  on public.music_video_submissions (provider_release_id)
  where provider_release_id is not null;

comment on column public.release_tracks.tiktok_start_time is
  'Optional TooLost TikTok clip start time value passed to the track API.';
comment on column public.music_video_submissions.provider_status is
  'Provider-reported music video release status. Never inferred as live.';
