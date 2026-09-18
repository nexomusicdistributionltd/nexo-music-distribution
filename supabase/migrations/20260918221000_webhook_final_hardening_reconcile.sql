-- Reconcile provider webhook enum typing found by the production rollback test.
create or replace function public.process_provider_webhook_event(
  p_provider_name text,
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_signature_valid boolean,
  p_release_id uuid default null,
  p_mapped_status text default null
)
returns public.provider_webhook_events
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.provider_webhook_events;
  existing public.provider_webhook_events;
  job public.distribution_jobs;
  release_row public.releases;
  target_status public.release_status;
  provider text := coalesce(nullif(trim(p_provider_name), ''), 'distribution_engine');
begin
  if uid is not null then
    raise exception 'Service role only' using errcode = '42501';
  end if;

  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'event_id required' using errcode = 'P0001';
  end if;

  select * into existing
  from public.provider_webhook_events
  where provider_name = provider and event_id = trim(p_event_id)
  for update;

  if found then
    if coalesce(existing.signature_valid, false) or not coalesce(p_signature_valid, false) then
      return existing;
    end if;

    -- Allow an authentic retry to recover an event id that was previously seen unsigned/invalid.
    update public.provider_webhook_events
    set event_type = p_event_type,
        signature_valid = true,
        payload = coalesce(p_payload, '{}'::jsonb),
        release_id = coalesce(p_release_id, release_id),
        mapped_status = p_mapped_status,
        process_status = 'received',
        error_message = null,
        processed_at = null
    where id = existing.id
    returning * into ev;
  else
    insert into public.provider_webhook_events (
      provider_name, event_id, event_type, signature_valid, payload,
      release_id, mapped_status, process_status
    ) values (
      provider, trim(p_event_id), p_event_type, coalesce(p_signature_valid, false),
      coalesce(p_payload, '{}'::jsonb), p_release_id, p_mapped_status,
      case when p_signature_valid is distinct from true then 'failed'::public.webhook_process_status else 'received'::public.webhook_process_status end
    )
    returning * into ev;
  end if;

  if p_signature_valid is distinct from true then
    update public.provider_webhook_events
    set process_status = 'failed',
        error_message = 'signature_invalid',
        processed_at = now()
    where id = ev.id
    returning * into ev;
    return ev;
  end if;

  if p_release_id is null then
    update public.provider_webhook_events
    set process_status = 'ignored',
        error_message = 'release_not_resolved',
        processed_at = now()
    where id = ev.id
    returning * into ev;
    return ev;
  end if;

  if p_mapped_status is null or p_mapped_status not in (
    'delivering', 'delivered', 'live', 'failed', 'taken_down', 'takedown_requested'
  ) then
    update public.provider_webhook_events
    set process_status = 'ignored',
        error_message = 'status_unmapped',
        processed_at = now()
    where id = ev.id
    returning * into ev;
    return ev;
  end if;

  target_status := p_mapped_status::public.release_status;

  select * into release_row
  from public.releases
  where id = p_release_id
  for update;

  if not found then
    update public.provider_webhook_events
    set process_status = 'ignored',
        error_message = 'release_not_found',
        processed_at = now()
    where id = ev.id
    returning * into ev;
    return ev;
  end if;

  select * into job
  from public.distribution_jobs
  where release_id = p_release_id
  order by updated_at desc
  limit 1;

  perform set_config('nexo.internal_release_update', '1', true);
  begin
    update public.releases
    set provider_connected = true,
        provider_name = provider,
        provider_status = p_mapped_status,
        updated_at = now()
    where id = p_release_id
    returning * into release_row;
  exception when others then
    perform set_config('nexo.internal_release_update', '0', true);
    raise;
  end;
  perform set_config('nexo.internal_release_update', '0', true);

  -- Repeated provider notifications for the same status are valid and idempotent.
  if release_row.status is distinct from target_status then
    perform set_config('nexo.trusted_status_transition', '1', true);
    begin
      perform public.transition_release_status(
        p_release_id,
        target_status,
        'Distribution Engine webhook',
        jsonb_build_object('source', 'webhook', 'event_id', p_event_id)
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      update public.provider_webhook_events
      set process_status = 'failed',
          error_message = 'status_transition_failed',
          processed_at = now(),
          job_id = job.id
      where id = ev.id
      returning * into ev;
      return ev;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);
  end if;

  if job.id is not null then
    update public.distribution_jobs
    set status = case
          when target_status = 'delivered' then 'delivered'::public.distribution_job_status
          when target_status = 'live' then 'live'::public.distribution_job_status
          when target_status = 'failed' then 'failed'::public.distribution_job_status
          when target_status = 'taken_down' then 'taken_down'::public.distribution_job_status
          when target_status = 'takedown_requested' then 'takedown_requested'::public.distribution_job_status
          when target_status = 'delivering' then 'submitted'::public.distribution_job_status
          else status
        end,
        last_sync_at = now(),
        last_error = case
          when target_status = 'failed' then coalesce(last_error, 'Distribution Engine reported failed')
          else null
        end,
        updated_at = now()
    where id = job.id;
  end if;

  update public.provider_webhook_events
  set process_status = 'processed',
      error_message = null,
      processed_at = now(),
      job_id = job.id,
      release_id = p_release_id,
      mapped_status = p_mapped_status
  where id = ev.id
  returning * into ev;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    null,
    'distribution_webhook'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object(
      'event_id', p_event_id,
      'event_type', p_event_type,
      'mapped_status', p_mapped_status,
      'via', 'service_role'
    )
  );

  return ev;
end;
$$;

revoke all on function public.process_provider_webhook_event(text, text, text, jsonb, boolean, uuid, text)
  from public, anon, authenticated;
grant execute on function public.process_provider_webhook_event(text, text, text, jsonb, boolean, uuid, text)
  to service_role;
