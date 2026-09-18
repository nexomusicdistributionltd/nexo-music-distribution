-- Atomic label roster artist + DSP profile link creation.
create or replace function public.create_label_roster_artist_with_dsp(
  p_stage_name text,
  p_bio text default null,
  p_country text default null,
  p_genres text[] default array[]::text[],
  p_avatar_url text default null,
  p_website text default null,
  p_dsp_links jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lid uuid;
  aid uuid;
  link jsonb;
  link_key text;
  link_url text;
  link_enabled boolean;
begin
  if uid is null or not public.has_role(uid, 'label') then
    raise exception 'Label role required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_stage_name, '')) = '' then
    raise exception 'Stage / display name is required' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_dsp_links, '[]'::jsonb)) <> 'array' then
    raise exception 'DSP links must be an array' using errcode = '22023';
  end if;

  select id into lid from public.label_profiles where user_id = uid limit 1;
  if lid is null then
    raise exception 'Label profile not found' using errcode = 'P0001';
  end if;

  insert into public.artist_profiles(
    user_id, profile_id, stage_name, artist_name, bio, country, genres,
    avatar_url, website, created_by_label_profile_id
  )
  values(
    null, null, btrim(p_stage_name), btrim(p_stage_name),
    nullif(btrim(coalesce(p_bio, '')), ''),
    nullif(btrim(coalesce(p_country, '')), ''),
    coalesce(p_genres, array[]::text[]),
    nullif(btrim(coalesce(p_avatar_url, '')), ''),
    nullif(btrim(coalesce(p_website, '')), ''),
    lid
  )
  returning id into aid;

  insert into public.label_roster_artists(label_profile_id, artist_profile_id, created_by)
  values(lid, aid, uid);

  for link in select value from jsonb_array_elements(coalesce(p_dsp_links, '[]'::jsonb))
  loop
    link_key := btrim(coalesce(link->>'dsp_key', ''));
    link_url := nullif(btrim(coalesce(link->>'url', '')), '');
    link_enabled := coalesce((link->>'enabled')::boolean, false);

    if link_key = '' then
      raise exception 'DSP key required' using errcode = '22023';
    end if;
    if link_enabled and link_url is null then
      raise exception 'Enabled DSP link requires URL' using errcode = '22023';
    end if;

    insert into public.artist_dsp_links(
      artist_profile_id, dsp_key, url, enabled, verification_status, verified_at, fetched_at
    )
    values(aid, link_key, link_url, link_enabled, 'unverified', null, null)
    on conflict (artist_profile_id, dsp_key) do update
      set url = excluded.url,
          enabled = excluded.enabled,
          verification_status = 'unverified',
          verified_at = null,
          fetched_at = null;
  end loop;

  return aid;
end;
$$;

revoke all on function public.create_label_roster_artist_with_dsp(text,text,text,text[],text,text,jsonb) from public;
grant execute on function public.create_label_roster_artist_with_dsp(text,text,text,text[],text,text,jsonb) to authenticated;
