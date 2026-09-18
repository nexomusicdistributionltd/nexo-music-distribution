-- Allow artist/label-owned Move In RPCs to audit their own operations without
-- routing through the staff-only generic write_audit_log policy.
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

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'catalog_migration'::public.audit_action, 'catalog_migration', m.id, jsonb_build_object('import_method', m.import_method, 'workflow_step', m.workflow_step));

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
  track_count_val int;
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

    select coalesce(array_agg(distinct upper(trim(v))) filter (where length(trim(v)) > 0), '{}'::text[])
    into isrcs
    from (
      select value as v
      from jsonb_array_elements_text(coalesce(item->'isrcs', '[]'::jsonb))
      union all
      select coalesce(track->>'isrc', '')
      from jsonb_array_elements(
        case when jsonb_typeof(item->'tracks') = 'array' then item->'tracks' else '[]'::jsonb end
      ) as track
    ) src;

    track_count_val := nullif(item->>'track_count', '')::int;
    if track_count_val is null and jsonb_typeof(item->'tracks') = 'array' then
      track_count_val := jsonb_array_length(item->'tracks');
    end if;
    if track_count_val is null and coalesce(array_length(isrcs,1),0) > 0 then
      track_count_val := array_length(isrcs,1);
    end if;

    if nullif(trim(coalesce(item->>'title', '')), '') is null then
      gaps := gaps || '["missing_title"]'::jsonb;
    end if;
    if nullif(trim(coalesce(item->>'artist_name', item->>'artistName', '')), '') is null then
      gaps := gaps || '["missing_artist"]'::jsonb;
    end if;
    if upc_val is null then
      gaps := gaps || '["missing_upc"]'::jsonb;
    end if;
    if coalesce(array_length(isrcs, 1), 0) = 0 then
      gaps := gaps || '["missing_isrc"]'::jsonb;
    end if;
    if coalesce(array_length(isrcs,1),0) > 1
       and not (jsonb_typeof(item->'tracks') = 'array' and jsonb_array_length(item->'tracks') > 0) then
      gaps := gaps || '["missing_track_titles"]'::jsonb;
    end if;

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
      track_count_val,
      coalesce(item, '{}'::jsonb),
      'pending',
      coalesce((item->>'selected')::boolean, true),
      gaps,
      nullif(trim(coalesce(item->>'previous_distributor', m.previous_distributor, '')), ''),
      coalesce(item, '{}'::jsonb),
      false,
      false
    );
    cnt := cnt + 1;
  end loop;

  update public.catalog_migrations set
    item_count = (select count(*) from public.catalog_migration_items where migration_id = m.id),
    workflow_step = case when cnt > 0 then 'select' else workflow_step end,
    status = 'review',
    last_job_status = 'items_imported',
    last_job_message = format('Imported %s catalog item(s) for review. No identifiers were invented.', cnt),
    last_job_at = now(),
    updated_at = now()
  where id = m.id
  returning * into m;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'catalog_migration_import'::public.audit_action, 'catalog_migration', m.id, jsonb_build_object('imported', cnt));

  return m;
end;
$$;

revoke all on function public.import_own_catalog_migration_items(uuid, jsonb) from public;
grant execute on function public.import_own_catalog_migration_items(uuid, jsonb) to authenticated;


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
  dup_upc boolean;
  dup_isrc boolean;
  tracks_json jsonb;
  track jsonb;
  track_title text;
  track_isrc text;
  track_no int;
  inserted_tracks int;
  source_isrc_count int;
  inserted_isrc_count int;
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
    where migration_id = m.id
      and selected = true
      and status not in ('imported', 'skipped', 'conflict')
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

      if not exists (
        select 1 from public.catalog_migration_conflicts
        where migration_id = m.id and item_id = it.id and status = 'open'
      ) then
        insert into public.catalog_migration_conflicts (
          migration_id, item_id, conflict_type, details, status
        ) values (
          m.id, it.id,
          case when dup_upc then 'duplicate_upc' else 'duplicate_isrc' end,
          jsonb_build_object('upc', it.external_upc, 'isrcs', to_jsonb(it.external_isrcs)),
          'open'
        );
      end if;
      continue;
    end if;

    if it.external_title is null or length(trim(it.external_title)) = 0 then
      skipped := skipped + 1;
      update public.catalog_migration_items set
        status = 'skipped',
        notes = 'Skipped: missing release title.',
        updated_at = now()
      where id = it.id;
      continue;
    end if;

    tracks_json := case
      when jsonb_typeof(it.import_payload->'tracks') = 'array' then it.import_payload->'tracks'
      else '[]'::jsonb
    end;

    if coalesce(array_length(it.external_isrcs,1),0) > 1 and jsonb_array_length(tracks_json) = 0 then
      skipped := skipped + 1;
      update public.catalog_migration_items set
        status = 'skipped',
        notes = 'Skipped: multi-track releases require track titles so Nexo does not invent metadata.',
        metadata_gaps = coalesce(metadata_gaps,'[]'::jsonb) || '["missing_track_titles"]'::jsonb,
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
      it.external_upc,
      'draft',
      case when m.previous_distributor is not null
        then 'Moved in from previous distributor: ' || m.previous_distributor
        else null end
    )
    returning id into new_release_id;

    inserted_tracks := 0;
    inserted_isrc_count := 0;
    source_isrc_count := coalesce(array_length(it.external_isrcs,1),0);

    if jsonb_array_length(tracks_json) > 0 then
      for track in select * from jsonb_array_elements(tracks_json)
      loop
        track_title := nullif(trim(coalesce(track->>'title','')), '');
        if track_title is null then
          continue;
        end if;
        track_no := coalesce(nullif(track->>'track_number','')::int, inserted_tracks + 1);
        track_isrc := upper(trim(coalesce(track->>'isrc','')));
        if track_isrc !~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$' then
          track_isrc := null;
        end if;

        insert into public.release_tracks (release_id, track_number, title, isrc)
        values (new_release_id, track_no, track_title, track_isrc);
        inserted_tracks := inserted_tracks + 1;
        if track_isrc is not null then inserted_isrc_count := inserted_isrc_count + 1; end if;
      end loop;
    else
      track_isrc := case
        when source_isrc_count = 1 and it.external_isrcs[1] ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$'
          then it.external_isrcs[1]
        else null
      end;
      insert into public.release_tracks (release_id, track_number, title, isrc)
      values (new_release_id, 1, it.external_title, track_isrc);
      inserted_tracks := 1;
      if track_isrc is not null then inserted_isrc_count := 1; end if;
    end if;

    if inserted_tracks = 0 then
      delete from public.releases where id = new_release_id;
      skipped := skipped + 1;
      update public.catalog_migration_items set
        status = 'skipped',
        notes = 'Skipped: no usable track titles were supplied.',
        updated_at = now()
      where id = it.id;
      continue;
    end if;

    update public.catalog_migration_items set
      status = 'imported',
      matched_release_id = new_release_id,
      draft_release_id = new_release_id,
      isrc_preserved = source_isrc_count > 0 and inserted_isrc_count = source_isrc_count,
      upc_preserved = it.external_upc is not null,
      updated_at = now()
    where id = it.id;

    imported := imported + 1;
  end loop;

  update public.catalog_migrations set
    imported_count = (select count(*) from public.catalog_migration_items where migration_id = m.id and status = 'imported'),
    conflict_count = (select count(*) from public.catalog_migration_items where migration_id = m.id and status = 'conflict'),
    item_count = (select count(*) from public.catalog_migration_items where migration_id = m.id),
    status = case
      when exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status in ('pending','ready','conflict','skipped','failed')
      ) then 'review'::public.catalog_migration_status
      when exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status = 'imported'
      ) then 'completed'::public.catalog_migration_status
      else 'review'::public.catalog_migration_status
    end,
    workflow_step = case
      when exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status in ('pending','ready','conflict','skipped','failed')
      ) then 'review'
      when exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status = 'imported'
      ) then 'done'
      else 'review'
    end,
    completed_at = case
      when not exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status in ('pending','ready','conflict','skipped','failed')
      ) and exists (
        select 1 from public.catalog_migration_items
        where migration_id = m.id and selected = true and status = 'imported'
      ) then now()
      else null
    end,
    last_job_status = case
      when conflicted > 0 or skipped > 0 then 'review_required'
      when imported > 0 then 'completed'
      else 'no_items'
    end,
    last_job_message = format(
      'Move In finished: %s draft release(s) created, %s conflict(s), %s skipped. Review is required for any unresolved item.',
      imported, conflicted, skipped
    ),
    last_job_at = now(),
    updated_at = now()
  where id = m.id
  returning * into m;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'catalog_migration_move_in'::public.audit_action, 'catalog_migration', m.id, jsonb_build_object('imported', imported, 'conflicts', conflicted, 'skipped', skipped));

  return m;
end;
$$;

revoke all on function public.move_in_own_catalog_migration(uuid) from public;
grant execute on function public.move_in_own_catalog_migration(uuid) to authenticated;
