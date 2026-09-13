-- NEXO Batch 6 hostile audit fixes
-- C1: trusted status bypass requires nexo.trusted_status_transition GUC (not client metadata)
-- C2: complete_submit success path service_role only
-- C3: process_provider_webhook_event service_role only
-- M1: apply_provider_sync_status staff RPC for sync transitions

-- ---------------------------------------------------------------------------
-- C1 — transition_release_status: GUC-gated trusted bypass + provider gate
-- ---------------------------------------------------------------------------
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
begin
  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  staff := actor is not null and (
    public.has_role(actor, 'admin')
    or public.has_role(actor, 'super_admin')
    or public.has_role(actor, 'support')
  );
  owner_ok := actor is not null and r.owner_user_id = actor;
  meta_source := coalesce(p_metadata->>'source', '');
  -- Client-supplied metadata alone must NEVER unlock privileged transitions.
  trusted := current_setting('nexo.trusted_status_transition', true) = '1';

  -- Owner transitions
  if owner_ok and not staff then
    if r.status in ('draft', 'changes_requested') and p_new_status = 'submitted' then
      allowed := true;
    elsif r.status in ('approved', 'scheduled', 'delivered', 'live')
          and p_new_status = 'takedown_requested' then
      allowed := true;
    end if;
  end if;

  -- Staff transitions (QC / ops)
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

  -- Trusted internal/provider sources — ONLY when GUC is set by SECURITY DEFINER caller
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

  -- Provider-gated statuses require provider_connected
  -- (complete_submit may have just flipped it in the same txn — re-read)
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
  values (r.id, r.status, p_new_status, actor, p_reason, coalesce(p_metadata, '{}'::jsonb));

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

  if p_new_status in ('approved', 'scheduled', 'delivering', 'delivered', 'live', 'failed', 'takedown_requested', 'taken_down') then
    perform public.enqueue_distribution_email(
      r.id,
      'release_status_' || p_new_status::text,
      jsonb_build_object('previous', null, 'status', p_new_status)
    );
  end if;

  return r;
end;
$$;

revoke all on function public.transition_release_status(uuid, public.release_status, text, jsonb) from public;
grant execute on function public.transition_release_status(uuid, public.release_status, text, jsonb) to authenticated;
grant execute on function public.transition_release_status(uuid, public.release_status, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- queue_approved_release — set trusted GUC around transition
-- ---------------------------------------------------------------------------
create or replace function public.queue_approved_release(
  p_release_id uuid,
  p_notes text default null
)
returns public.distribution_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.releases;
  job public.distribution_jobs;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if r.status not in ('approved', 'scheduled', 'failed') then
    raise exception 'Only approved/scheduled/failed releases can be queued (got %)', r.status
      using errcode = 'P0001';
  end if;

  if r.status in ('approved', 'failed') then
    perform set_config('nexo.trusted_status_transition', '1', true);
    begin
      perform public.transition_release_status(
        p_release_id,
        'scheduled',
        coalesce(p_notes, 'Queued for distribution'),
        jsonb_build_object('source', 'queue_approved_release')
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      raise;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);
  end if;

  insert into public.distribution_jobs (
    release_id, provider_name, status, created_by, metadata
  ) values (
    p_release_id,
    coalesce(nullif(r.provider_name, ''), 'not_connected'),
    'queued',
    actor,
    jsonb_build_object('notes', p_notes)
  )
  on conflict (release_id, provider_name) do update
    set status = case
          when public.distribution_jobs.status in ('delivered', 'live', 'taken_down')
            then public.distribution_jobs.status
          else 'queued'
        end,
        retry_count = case
          when public.distribution_jobs.status = 'failed' then public.distribution_jobs.retry_count
          else public.distribution_jobs.retry_count
        end,
        last_error = null,
        queued_at = now(),
        updated_at = now(),
        metadata = public.distribution_jobs.metadata || jsonb_build_object('requeued_at', now())
  returning * into job;

  perform public.write_audit_log(
    'distribution_queue'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object('job_id', job.id, 'notes', p_notes)
  );

  perform public.enqueue_distribution_email(
    p_release_id,
    'release_queued_for_distribution',
    jsonb_build_object('job_id', job.id, 'status', 'queued')
  );

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  values (
    r.owner_user_id,
    'distribution_update',
    'Release queued for distribution',
    'Your release was queued. Delivery requires a connected distribution provider.',
    'release',
    p_release_id
  );

  return job;
end;
$$;

revoke all on function public.queue_approved_release(uuid, text) from public;
grant execute on function public.queue_approved_release(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- C2 — complete_submit_queued_release: success = service_role only
-- ---------------------------------------------------------------------------
create or replace function public.complete_submit_queued_release(
  p_submission_id uuid,
  p_ok boolean,
  p_provider_release_id text default null,
  p_response_ref text default null,
  p_response_payload jsonb default null,
  p_error_code text default null,
  p_error_message text default null
)
returns public.distribution_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  sub public.provider_submissions;
  job public.distribution_jobs;
begin
  if p_ok then
    -- Success finalize is service_role only (auth.uid() is null)
    if actor is not null then
      raise exception 'Service role only for successful submit finalize' using errcode = '42501';
    end if;
  else
    -- Failure path: staff JWT or service_role
    if actor is not null and not public.is_staff(actor) then
      raise exception 'Staff only' using errcode = '42501';
    end if;
  end if;

  select * into sub from public.provider_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  select * into job from public.distribution_jobs where id = sub.job_id for update;

  if p_ok then
    if p_provider_release_id is null or length(trim(p_provider_release_id)) = 0 then
      raise exception 'provider_release_id required on success' using errcode = 'P0001';
    end if;

    update public.provider_submissions
    set status = 'accepted',
        provider_release_id = p_provider_release_id,
        response_ref = p_response_ref,
        response_payload = coalesce(p_response_payload, '{}'::jsonb),
        completed_at = now()
    where id = sub.id;

    update public.distribution_jobs
    set status = 'submitted',
        provider_release_id = p_provider_release_id,
        response_ref = p_response_ref,
        submitted_at = now(),
        last_error = null,
        updated_at = now()
    where id = job.id
    returning * into job;

    perform set_config('nexo.internal_release_update', '1', true);
    update public.releases
    set provider_release_id = p_provider_release_id,
        provider_name = job.provider_name,
        provider_status = 'submitted',
        provider_connected = true,
        updated_at = now()
    where id = job.release_id;
    perform set_config('nexo.internal_release_update', '0', true);

    perform set_config('nexo.trusted_status_transition', '1', true);
    begin
      perform public.transition_release_status(
        job.release_id,
        'delivering',
        'Submitted to distribution provider',
        jsonb_build_object('source', 'complete_submit_queued_release', 'submission_id', sub.id)
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      -- leave job submitted; status transition may fail if already delivering
      null;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);

    perform public.enqueue_distribution_email(
      job.release_id,
      'release_distributing',
      jsonb_build_object('job_id', job.id)
    );

    -- write_audit_log requires auth.uid(); skip under service_role
    if actor is not null then
      perform public.write_audit_log(
        'distribution_submit'::public.audit_action,
        'release',
        job.release_id,
        jsonb_build_object('ok', true, 'submission_id', sub.id, 'provider_release_id', p_provider_release_id)
      );
    else
      insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
      values (
        null,
        'distribution_submit'::public.audit_action,
        'release',
        job.release_id,
        jsonb_build_object('ok', true, 'submission_id', sub.id, 'provider_release_id', p_provider_release_id, 'via', 'service_role')
          - 'password' - 'token' - 'access_token' - 'refresh_token' - 'service_role_key'
      );
    end if;
  else
    update public.provider_submissions
    set status = 'failed',
        error_code = coalesce(p_error_code, 'SUBMIT_FAILED'),
        error_message = p_error_message,
        response_payload = coalesce(p_response_payload, '{}'::jsonb),
        completed_at = now()
    where id = sub.id;

    update public.distribution_jobs
    set status = 'failed',
        retry_count = retry_count + 1,
        last_error = coalesce(p_error_message, p_error_code, 'Submit failed'),
        next_retry_at = now() + (interval '15 minutes' * least(retry_count + 1, 8)),
        updated_at = now()
    where id = job.id
    returning * into job;

    insert into public.distribution_retries (
      job_id, release_id, attempt_number, reason, outcome, error_message, created_by, finished_at
    ) values (
      job.id, job.release_id, job.retry_count,
      coalesce(p_error_code, 'submit_failed'),
      case when p_error_code = 'PROVIDER_NOT_CONNECTED' then 'unavailable' else 'failed' end,
      p_error_message,
      actor,
      now()
    );

    perform set_config('nexo.trusted_status_transition', '1', true);
    begin
      perform public.transition_release_status(
        job.release_id,
        'failed',
        coalesce(p_error_message, 'Distribution submit failed'),
        jsonb_build_object('source', 'complete_submit_queued_release', 'error_code', p_error_code)
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      null;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);

    perform public.enqueue_distribution_email(
      job.release_id,
      'release_distribution_failed',
      jsonb_build_object('job_id', job.id, 'error', p_error_message)
    );

    if actor is not null then
      perform public.write_audit_log(
        'distribution_submit'::public.audit_action,
        'release',
        job.release_id,
        jsonb_build_object('ok', false, 'submission_id', sub.id, 'error_code', p_error_code)
      );
    end if;
  end if;

  return job;
end;
$$;

revoke all on function public.complete_submit_queued_release(uuid, boolean, text, text, jsonb, text, text) from public;
grant execute on function public.complete_submit_queued_release(uuid, boolean, text, text, jsonb, text, text) to authenticated;
grant execute on function public.complete_submit_queued_release(uuid, boolean, text, text, jsonb, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- C3 — process_provider_webhook_event: service_role only + trusted GUC
-- ---------------------------------------------------------------------------
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
  ev public.provider_webhook_events;
  job public.distribution_jobs;
  target_status public.release_status;
  uid uuid := auth.uid();
begin
  -- Service role only (auth.uid() is null). Staff JWT cannot forge webhooks.
  if uid is not null then
    raise exception 'Service role only' using errcode = '42501';
  end if;

  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'event_id required' using errcode = 'P0001';
  end if;

  insert into public.provider_webhook_events (
    provider_name, event_id, event_type, signature_valid, payload,
    release_id, mapped_status, process_status
  ) values (
    p_provider_name, p_event_id, p_event_type, p_signature_valid,
    coalesce(p_payload, '{}'::jsonb), p_release_id, p_mapped_status,
    case when p_signature_valid is distinct from true then 'failed' else 'received' end
  )
  on conflict (provider_name, event_id) do update
    set process_status = 'duplicate'
  returning * into ev;

  if ev.process_status = 'duplicate' then
    return ev;
  end if;

  if p_signature_valid is distinct from true then
    update public.provider_webhook_events
    set process_status = 'failed',
        error_message = 'Signature invalid or webhook secret missing',
        processed_at = now()
    where id = ev.id
    returning * into ev;
    return ev;
  end if;

  if p_release_id is not null then
    select * into job from public.distribution_jobs
    where release_id = p_release_id
    order by updated_at desc
    limit 1;
  end if;

  if p_release_id is not null and p_mapped_status is not null then
    target_status := null;
    if p_mapped_status in ('delivering', 'delivered', 'live', 'failed', 'taken_down', 'takedown_requested') then
      target_status := p_mapped_status::public.release_status;
    end if;

    if target_status is not null then
      perform set_config('nexo.trusted_status_transition', '1', true);
      begin
        perform public.transition_release_status(
          p_release_id,
          target_status,
          'Provider webhook: ' || p_event_type,
          jsonb_build_object('source', 'webhook', 'event_id', p_event_id)
        );
      exception when others then
        perform set_config('nexo.trusted_status_transition', '0', true);
        update public.provider_webhook_events
        set process_status = 'failed',
            error_message = SQLERRM,
            processed_at = now(),
            job_id = job.id
        where id = ev.id
        returning * into ev;
        return ev;
      end;
      perform set_config('nexo.trusted_status_transition', '0', true);

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
            updated_at = now()
        where id = job.id;
      end if;

      perform public.enqueue_distribution_email(
        p_release_id,
        'release_' || p_mapped_status,
        jsonb_build_object('event_id', p_event_id, 'event_type', p_event_type)
      );
    end if;
  end if;

  update public.provider_webhook_events
  set process_status = 'processed',
      processed_at = now(),
      job_id = job.id,
      release_id = coalesce(release_id, p_release_id)
  where id = ev.id
  returning * into ev;

  -- Persist system audit row (no auth.uid under service_role)
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    null,
    'distribution_webhook'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object('event_id', p_event_id, 'event_type', p_event_type, 'mapped_status', p_mapped_status, 'via', 'service_role')
      - 'password' - 'token' - 'access_token' - 'refresh_token' - 'service_role_key'
  );

  return ev;
end;
$$;

revoke all on function public.process_provider_webhook_event(text, text, text, jsonb, boolean, uuid, text) from public;
revoke all on function public.process_provider_webhook_event(text, text, text, jsonb, boolean, uuid, text) from authenticated;
grant execute on function public.process_provider_webhook_event(text, text, text, jsonb, boolean, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- reinstate_distribution_release — set trusted GUC around transition
-- ---------------------------------------------------------------------------
create or replace function public.reinstate_distribution_release(
  p_release_id uuid,
  p_reason text default null
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.releases;
  target public.release_status;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if r.status not in ('takedown_requested', 'taken_down') then
    raise exception 'Reinstate only from takedown states' using errcode = 'P0001';
  end if;

  target := case
    when r.provider_connected and r.provider_status in ('live', 'delivered') then 'live'
    when r.provider_connected then 'delivered'
    else 'approved'
  end;

  if r.status = 'taken_down' then
    perform set_config('nexo.internal_release_update', '1', true);
    insert into public.release_status_history (release_id, previous_status, new_status, actor_user_id, reason, metadata)
    values (r.id, r.status, target, actor, coalesce(p_reason, 'Reinstated'), jsonb_build_object('source', 'reinstate_distribution_release'));
    update public.releases set status = target, updated_at = now() where id = r.id returning * into r;
    perform set_config('nexo.internal_release_update', '0', true);
  else
    perform set_config('nexo.trusted_status_transition', '1', true);
    begin
      r := public.transition_release_status(
        p_release_id,
        case when target = 'approved' then 'live' else target end,
        coalesce(p_reason, 'Reinstated'),
        jsonb_build_object('source', 'reinstate_distribution_release')
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      raise;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);
  end if;

  update public.distribution_jobs
  set status = case when target in ('live', 'delivered') then target::text::public.distribution_job_status else 'queued' end,
      updated_at = now()
  where release_id = p_release_id;

  perform public.enqueue_distribution_email(
    p_release_id,
    'release_reinstated',
    jsonb_build_object('status', r.status)
  );

  perform public.write_audit_log(
    'distribution_reinstate'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object('reason', p_reason, 'new_status', r.status)
  );

  return r;
end;
$$;

revoke all on function public.reinstate_distribution_release(uuid, text) from public;
grant execute on function public.reinstate_distribution_release(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- M1 — apply_provider_sync_status: staff-only trusted sync transition
-- ---------------------------------------------------------------------------
create or replace function public.apply_provider_sync_status(
  p_job_id uuid,
  p_mapped_status text,
  p_provider_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  job public.distribution_jobs;
  run public.provider_sync_runs;
  target public.release_status;
  r public.releases;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  if p_mapped_status is null or p_mapped_status not in (
    'delivering', 'delivered', 'live', 'failed', 'takedown_requested', 'taken_down'
  ) then
    raise exception 'Invalid mapped status for provider sync' using errcode = 'P0001';
  end if;

  target := p_mapped_status::public.release_status;

  select * into job from public.distribution_jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  perform set_config('nexo.trusted_status_transition', '1', true);
  begin
    r := public.transition_release_status(
      job.release_id,
      target,
      'Provider sync',
      jsonb_build_object(
        'source', 'apply_provider_sync_status',
        'provider_status', p_provider_status
      )
    );
  exception when others then
    perform set_config('nexo.trusted_status_transition', '0', true);
    raise;
  end;
  perform set_config('nexo.trusted_status_transition', '0', true);

  update public.distribution_jobs
  set status = case
        when target = 'delivered' then 'delivered'::public.distribution_job_status
        when target = 'live' then 'live'::public.distribution_job_status
        when target = 'failed' then 'failed'::public.distribution_job_status
        when target = 'taken_down' then 'taken_down'::public.distribution_job_status
        when target = 'takedown_requested' then 'takedown_requested'::public.distribution_job_status
        when target = 'delivering' then 'submitted'::public.distribution_job_status
        else status
      end,
      last_sync_at = now(),
      last_error = case when target = 'failed' then coalesce(last_error, 'Provider sync reported failed') else null end,
      updated_at = now()
  where id = job.id
  returning * into job;

  insert into public.provider_sync_runs (
    job_id, release_id, provider_name, trigger_source, status,
    provider_status, delivery_status, error_message, response_ref,
    created_by, finished_at
  ) values (
    job.id, job.release_id, job.provider_name, 'admin', 'succeeded',
    p_provider_status, p_mapped_status, null, null,
    actor,
    now()
  )
  returning * into run;

  perform public.write_audit_log(
    'distribution_sync'::public.audit_action,
    'release',
    job.release_id,
    jsonb_build_object('run_id', run.id, 'status', 'succeeded', 'mapped_status', p_mapped_status)
  );

  return jsonb_build_object(
    'job_id', job.id,
    'release_id', job.release_id,
    'release_status', r.status,
    'run_id', run.id,
    'mapped_status', p_mapped_status,
    'provider_status', p_provider_status
  );
end;
$$;

revoke all on function public.apply_provider_sync_status(uuid, text, text) from public;
grant execute on function public.apply_provider_sync_status(uuid, text, text) to authenticated;

comment on function public.apply_provider_sync_status(uuid, text, text) is
  'Staff-only: apply provider sync mapped status via trusted GUC. Clients cannot spoof metadata.source bypass.';
comment on function public.transition_release_status(uuid, public.release_status, text, jsonb) is
  'Status machine. Trusted meta_source bypass requires nexo.trusted_status_transition=1 set by SECURITY DEFINER callers only.';
