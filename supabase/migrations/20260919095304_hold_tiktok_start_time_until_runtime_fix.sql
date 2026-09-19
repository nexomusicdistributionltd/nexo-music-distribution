-- Temporary production guard for the currently deployed runtime.
--
-- TooLost documents tiktokStartTime as zero-padded MM:SS (for example 00:30).
-- The older production runtime strips the leading zero before provider delivery,
-- turning 00:04 into 0:04 and causing HTTP 422 validation failures.
--
-- Preserve the artist-selected value internally, but keep tiktok_start_time null
-- until the fixed runtime is deployed. The application will therefore omit the
-- optional field from provider payloads instead of exposing a provider error to
-- artists/labels.

alter table public.release_tracks
  add column if not exists tiktok_start_time_pending text;

update public.release_tracks
set tiktok_start_time_pending = coalesce(tiktok_start_time_pending, tiktok_start_time),
    tiktok_start_time = null,
    updated_at = now()
where tiktok_start_time is not null
  and btrim(tiktok_start_time) <> '';

create or replace function public.hold_tiktok_start_time_until_runtime_fix()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tiktok_start_time is not null and btrim(new.tiktok_start_time) <> '' then
    new.tiktok_start_time_pending := btrim(new.tiktok_start_time);
    new.tiktok_start_time := null;
  end if;
  return new;
end;
$$;

drop trigger if exists release_tracks_hold_tiktok_start_time on public.release_tracks;

create trigger release_tracks_hold_tiktok_start_time
before insert or update of tiktok_start_time
on public.release_tracks
for each row
execute function public.hold_tiktok_start_time_until_runtime_fix();

comment on column public.release_tracks.tiktok_start_time_pending is
  'Temporary internal hold for artist-selected TikTok preview time while the production runtime still sends the legacy non-zero-padded TooLost format. Restore after the fixed runtime is deployed.';

comment on function public.hold_tiktok_start_time_until_runtime_fix() is
  'Temporary production safety guard: prevents the old runtime from sending invalid TooLost tiktokStartTime values while preserving the requested value internally.';
