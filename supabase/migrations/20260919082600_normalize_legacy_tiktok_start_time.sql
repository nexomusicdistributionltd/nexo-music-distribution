-- TooLost track metadata expects TikTok start time as zero-padded MM:SS.
update public.release_tracks
set tiktok_start_time =
      lpad(split_part(btrim(tiktok_start_time), ':', 1), 2, '0')
      || ':' ||
      split_part(btrim(tiktok_start_time), ':', 2),
    updated_at = now()
where tiktok_start_time is not null
  and btrim(tiktok_start_time) ~ '^[0-9]:[0-5][0-9]$';
