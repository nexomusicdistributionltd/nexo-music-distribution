-- Map release state-machine transitions to NexoBot catalog keys.
-- Enqueue is best-effort: failure MUST NOT roll back the release status.
-- SENT is never written here. Dormant LIVE/DELIVERED only on real provider sources.

create or replace function public.catalog_key_for_release_transition(
  p_from public.release_status,
  p_to public.release_status
)
returns text
language plpgsql
immutable
as $$
begin
  if p_to = 'changes_requested' and p_from in ('approved', 'scheduled', 'delivering', 'delivered', 'live', 'failed') then
    return 'RELEASE_UPDATE_REQUIRED';
  end if;
  return case p_to
    when 'submitted' then 'RELEASE_SUBMITTED'
    when 'in_qc' then 'RELEASE_UNDER_REVIEW'
    when 'changes_requested' then 'RELEASE_CHANGES_REQUIRED'
    when 'rejected' then 'RELEASE_REJECTED'
    when 'approved' then 'RELEASE_APPROVED'
    when 'scheduled' then 'RELEASE_QUEUED'
    when 'delivering' then 'RELEASE_DISTRIBUTING'
    when 'delivered' then 'RELEASE_DELIVERED'
    when 'live' then 'RELEASE_LIVE'
    when 'failed' then 'RELEASE_FAILED'
    when 'takedown_requested' then 'RELEASE_TAKEDOWN_REQUESTED'
    when 'taken_down' then 'RELEASE_TAKEDOWN_COMPLETED'
    else null
  end;
end;
$$;

create or replace function public.enqueue_release_catalog_email(
  p_release_id uuid,
  p_from public.release_status,
  p_to public.release_status,
  p_history_id uuid,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  owner_email text;
  first_name text;
  rel public.releases;
  catalog_key text;
  event_type text;
  allow_dormant boolean := false;
  meta_source text;
  payload jsonb;
  eid uuid;
begin
  catalog_key := public.catalog_key_for_release_transition(p_from, p_to);
  if catalog_key is null then
    return null;
  end if;

  if not public.email_automation_allows(catalog_key) then
    return null;
  end if;

  select * into rel from public.releases where id = p_release_id;
  if not found then
    return null;
  end if;

  select p.id, p.email, split_part(coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), p.email), ' ', 1)
    into owner_id, owner_email, first_name
  from public.profiles p
  where p.id = rel.owner_user_id;

  if owner_email is null or length(trim(owner_email)) = 0 then
    return null;
  end if;

  meta_source := coalesce(p_metadata->>'source', '');
  allow_dormant := coalesce(rel.provider_connected, false)
    and meta_source in ('webhook', 'sync_release_status', 'apply_provider_sync_status');

  if catalog_key in ('RELEASE_DELIVERED', 'RELEASE_LIVE') and not allow_dormant then
    return null;
  end if;

  event_type := case
    when catalog_key in ('RELEASE_APPROVED', 'RELEASE_CHANGES_REQUIRED', 'RELEASE_REJECTED') then 'release.qc'
    when catalog_key = 'RELEASE_SUBMITTED' then 'release.submit'
    else 'release.status'
  end;

  payload := jsonb_build_object(
    'FIRST_NAME', coalesce(first_name, 'there'),
    'RELEASE_TITLE', coalesce(rel.title, ''),
    'ARTIST_NAME', coalesce(rel.primary_artist_name, ''),
    'LABEL_NAME', coalesce(rel.label_name, ''),
    'UPC', coalesce(rel.upc, ''),
    'RELEASE_DATE', coalesce(rel.release_date::text, ''),
    'RELEASE_STATUS', p_to::text,
    'STATUS_LABEL', initcap(replace(p_to::text, '_', ' ')),
    'QC_NOTES', coalesce(p_reason, ''),
    'CTA_URL', 'https://nexomusicdistribution.com/dashboard/releases/' || p_release_id::text,
    'CTA_LABEL', 'Open release',
    'PREHEADER', coalesce(rel.title, 'Nexo release update'),
    '_allow_dormant', allow_dormant
  );

  eid := public.enqueue_email_event(
    event_type,
    catalog_key,
    owner_id,
    owner_email,
    p_release_id,
    'release',
    p_release_id,
    payload,
    'RELEASE_STATUS:' || p_release_id::text || ':' || p_to::text || ':' || coalesce(p_history_id::text, 'none'),
    null
  );

  return eid;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.enqueue_release_catalog_email(uuid, public.release_status, public.release_status, uuid, text, jsonb) from public;
grant execute on function public.enqueue_release_catalog_email(uuid, public.release_status, public.release_status, uuid, text, jsonb) to authenticated, service_role;

-- Keep legacy helper: map old release_status_* keys onto the catalog, never mark sent.
create or replace function public.enqueue_distribution_email(
  p_release_id uuid,
  p_template_key text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  mapped text;
  status_guess public.release_status;
begin
  mapped := p_template_key;
  if p_template_key like 'release_status_%' then
    begin
      status_guess := substring(p_template_key from 16)::public.release_status;
      mapped := public.catalog_key_for_release_transition(status_guess, status_guess);
    exception when others then
      mapped := upper(p_template_key);
    end;
  end if;
  if mapped is null then
    return null;
  end if;
  return public.enqueue_release_catalog_email(
    p_release_id,
    coalesce(status_guess, 'approved'),
    coalesce(status_guess, 'approved'),
    gen_random_uuid(),
    p_payload->>'reason',
    coalesce(p_payload, '{}'::jsonb)
  );
exception
  when others then
    return null;
end;
$$;

-- Latest transition_release_status (Batch 6 hostile audit) + catalog enqueue after commit-ready update.
create or replace function public.transition_release_status(
  p_release_id uuid,
  p_new_status public.release_status,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.releases;
  actor uuid := auth.uid();
  staff boolean;
  owner_ok boolean;
  allowed boolean := false;
  meta_source text;
  trusted boolean;
  prev public.release_status;
  hist_id uuid;
begin
  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  prev := r.status;
  staff := actor is not null and (
    public.has_role(actor, 'admin')
    or public.has_role(actor, 'super_admin')
    or public.has_role(actor, 'support')
  );
  owner_ok := actor is not null and r.owner_user_id = actor;
  meta_source := coalesce(p_metadata->>'source', '');
  trusted := current_setting('nexo.trusted_status_transition', true) = '1';

  if owner_ok and not staff then
    if r.status in ('draft', 'changes_requested') and p_new_status = 'submitted' then
      allowed := true;
    elsif r.status in ('approved', 'scheduled', 'delivered', 'live')
          and p_new_status = 'takedown_requested' then
      allowed := true;
    end if;
  end if;

  if staff then
    if r.status = 'submitted' and p_new_status in ('in_qc', 'changes_requested', 'rejected', 'approved') then
      allowed := true;
    elsif r.status = 'in_qc' and p_new_status in ('changes_requested', 'rejected', 'approved') then
      allowed := true;
    elsif r.status = 'approved' and p_new_status in ('scheduled', 'rejected', 'changes_requested') then
      allowed := true;
    elsif r.status = 'scheduled' and p_new_status in ('delivering', 'changes_requested', 'failed') then
      allowed := true;
    elsif r.status = 'delivering' and p_new_status in ('delivered', 'live', 'rejected', 'failed') then
      allowed := true;
    elsif r.status = 'delivered' and p_new_status in ('live', 'failed') then
      allowed := true;
    elsif r.status = 'failed' and p_new_status in ('scheduled', 'approved', 'changes_requested') then
      allowed := true;
    elsif r.status = 'takedown_requested' and p_new_status in ('taken_down', 'live', 'delivered') then
      allowed := true;
    elsif r.status = 'rejected' and p_new_status in ('draft', 'changes_requested') then
      allowed := true;
    elsif r.status = 'live' and p_new_status in ('takedown_requested', 'taken_down') then
      allowed := true;
    end if;
  end if;

  if not allowed and trusted and meta_source in (
    'complete_submit_queued_release',
    'webhook',
    'sync_release_status',
    'queue_approved_release',
    'reinstate_distribution_release',
    'apply_provider_sync_status'
  ) then
    if r.status is distinct from p_new_status then
      allowed := true;
    end if;
  end if;

  if not allowed then
    raise exception 'Transition from % to % is not permitted for this actor', r.status, p_new_status
      using errcode = '42501';
  end if;

  if p_new_status in ('delivering', 'delivered', 'live') then
    select provider_connected into r.provider_connected from public.releases where id = p_release_id;
    if not coalesce(r.provider_connected, false) then
      if not (
        trusted
        and meta_source = 'complete_submit_queued_release'
      ) then
        raise exception 'Provider not connected — cannot move to %', p_new_status
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  perform set_config('nexo.internal_release_update', '1', true);

  insert into public.release_status_history (release_id, previous_status, new_status, actor_user_id, reason, metadata)
  values (r.id, r.status, p_new_status, actor, p_reason, coalesce(p_metadata, '{}'::jsonb))
  returning id into hist_id;

  update public.releases
  set
    status = p_new_status,
    submitted_at = case when p_new_status = 'submitted' then now() else submitted_at end,
    locked_at = case
      when p_new_status in ('submitted', 'in_qc', 'approved', 'scheduled', 'delivering', 'delivered', 'live', 'takedown_requested', 'taken_down', 'failed')
        then coalesce(locked_at, now())
      when p_new_status in ('draft', 'changes_requested')
        then null
      else locked_at
    end,
    rejection_reason = case when p_new_status = 'rejected' then p_reason else rejection_reason end,
    changes_requested_reason = case when p_new_status = 'changes_requested' then p_reason else changes_requested_reason end,
    updated_at = now()
  where id = r.id
  returning * into r;

  perform set_config('nexo.internal_release_update', '0', true);

  -- Best-effort catalog enqueue. Must not fail the transition or invent SENT.
  perform public.enqueue_release_catalog_email(
    r.id, prev, p_new_status, hist_id, p_reason, coalesce(p_metadata, '{}'::jsonb)
  );

  return r;
end;
$$;

revoke all on function public.transition_release_status(uuid, public.release_status, text, jsonb) from public;
grant execute on function public.transition_release_status(uuid, public.release_status, text, jsonb) to authenticated;
grant execute on function public.transition_release_status(uuid, public.release_status, text, jsonb) to service_role;
