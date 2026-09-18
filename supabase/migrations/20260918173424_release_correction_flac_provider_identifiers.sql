-- Production reconciliation: FLAC-only audio, admin post-approval corrections,
-- and provider-assigned UPC/ISRC persistence.

update storage.buckets
set allowed_mime_types = array['audio/flac']::text[]
where id = 'release-audio';

create or replace function public.admin_reopen_release_for_corrections(
  p_release_id uuid,
  p_reason text
)
returns public.releases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_release public.releases;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_actor is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role in ('admin', 'super_admin')
  ) then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  if v_reason is null or char_length(v_reason) < 4 then
    raise exception 'A clear correction reason is required' using errcode = '22023';
  end if;

  select *
  into v_release
  from public.releases
  where id = p_release_id
  for update;

  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if v_release.status not in ('approved', 'scheduled', 'failed') then
    raise exception 'Only approved, scheduled, or failed releases can be reopened for corrections (got %)', v_release.status
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.distribution_jobs j
    where j.release_id = p_release_id
      and j.status in (
        'submitting',
        'submitted',
        'syncing',
        'delivered',
        'live',
        'takedown_requested',
        'taken_down',
        'reinstating'
      )
  ) then
    raise exception 'Distribution has already started for this release. Use the delivery/takedown workflow instead of reopening it.'
      using errcode = 'P0001';
  end if;

  update public.distribution_jobs
  set status = 'cancelled',
      last_error = null,
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'cancelled_for_corrections_at', now(),
        'cancelled_by', v_actor
      )
  where release_id = p_release_id
    and status in ('queued', 'failed');

  v_release := public.transition_release_status(
    p_release_id,
    'changes_requested'::public.release_status,
    v_reason,
    jsonb_build_object('source', 'admin_correction')
  );

  insert into public.notifications (
    user_id, type, title, body, entity_type, entity_id
  ) values (
    v_release.owner_user_id,
    'qc_changes_requested',
    'Release changes required',
    v_reason,
    'release',
    p_release_id
  );

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor,
    'release_status_change'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object(
      'status', 'changes_requested',
      'reason', v_reason,
      'source', 'admin_correction'
    )
  );

  return v_release;
end;
$$;

revoke all on function public.admin_reopen_release_for_corrections(uuid, text)
from public, anon;
grant execute on function public.admin_reopen_release_for_corrections(uuid, text)
to authenticated, service_role;

create or replace function public.apply_provider_assigned_identifiers(
  p_release_id uuid,
  p_upc text default null,
  p_track_identifiers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_upc text := regexp_replace(coalesce(p_upc, ''), '[^0-9]', '', 'g');
  v_item jsonb;
  v_track_number integer;
  v_isrc text;
  v_provider_track_id text;
  v_upc_applied integer := 0;
  v_isrc_applied integer := 0;
  v_provider_ids_applied integer := 0;
begin
  if auth.uid() is not null then
    raise exception 'Service role only' using errcode = '42501';
  end if;

  if not exists (select 1 from public.releases where id = p_release_id) then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  perform set_config('nexo.internal_release_update', '1', true);

  if v_upc ~ '^[0-9]{12,14}$' then
    update public.releases
    set upc = v_upc,
        updated_at = now()
    where id = p_release_id
      and nullif(btrim(coalesce(upc, '')), '') is null;
    get diagnostics v_upc_applied = row_count;
  end if;

  if jsonb_typeof(coalesce(p_track_identifiers, '[]'::jsonb)) = 'array' then
    for v_item in
      select value
      from jsonb_array_elements(coalesce(p_track_identifiers, '[]'::jsonb))
    loop
      if jsonb_typeof(v_item) <> 'object' then
        continue;
      end if;

      begin
        v_track_number := nullif(v_item->>'trackNumber', '')::integer;
      exception when others then
        v_track_number := null;
      end;

      v_isrc := upper(regexp_replace(coalesce(v_item->>'isrc', ''), '[^A-Za-z0-9]', '', 'g'));
      v_provider_track_id := nullif(btrim(coalesce(v_item->>'providerTrackId', '')), '');

      if v_track_number is not null and v_track_number > 0 then
        if v_isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$' then
          update public.release_tracks
          set isrc = v_isrc,
              updated_at = now()
          where release_id = p_release_id
            and track_number = v_track_number
            and nullif(btrim(coalesce(isrc, '')), '') is null;
          v_isrc_applied := v_isrc_applied + case when found then 1 else 0 end;
        end if;

        if v_provider_track_id is not null then
          update public.distribution_jobs
          set provider_track_ids =
                coalesce(provider_track_ids, '{}'::jsonb)
                || jsonb_build_object(v_track_number::text, v_provider_track_id),
              updated_at = now()
          where release_id = p_release_id;
          if found then
            v_provider_ids_applied := v_provider_ids_applied + 1;
          end if;
        end if;
      end if;
    end loop;
  end if;

  perform set_config('nexo.internal_release_update', '0', true);

  return jsonb_build_object(
    'upc_applied', v_upc_applied,
    'isrc_applied', v_isrc_applied,
    'provider_track_ids_applied', v_provider_ids_applied
  );
exception when others then
  perform set_config('nexo.internal_release_update', '0', true);
  raise;
end;
$$;

revoke all on function public.apply_provider_assigned_identifiers(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.apply_provider_assigned_identifiers(uuid, text, jsonb)
to service_role;
