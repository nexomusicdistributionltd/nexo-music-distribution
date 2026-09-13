-- Batch 6 hardening: allowlist new audit actions; service-safe webhook audit

create or replace function public.write_audit_log(
  p_action public.audit_action,
  p_entity_type text default 'user',
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  safe_meta jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required to write audit logs' using errcode = '42501';
  end if;

  if p_action in (
    'login', 'logout', 'profile_update', 'password_reset_request',
    'signup', 'email_verified', 'release_submit', 'release_update',
    'release_status_change', 'release_create', 'release_duplicate',
    'release_takedown_request', 'asset_upload'
  ) then
    null;
  elsif p_action in (
    'qc_review', 'qc_claim', 'qc_bulk', 'ticket_update', 'compliance_update',
    'admin_search', 'contact_message', 'payout_status_change', 'royalty_adjustment',
    'account_suspend', 'account_restore', 'account_restrict',
    'distribution_queue', 'distribution_submit', 'distribution_sync',
    'distribution_webhook', 'distribution_takedown', 'distribution_reinstate',
    'distribution_retry', 'catalog_migration', 'catalog_mapping'
  ) then
    if not public.is_admin_portal_staff(uid) then
      raise exception 'Audit action requires staff privileges' using errcode = '42501';
    end if;
  elsif p_action in ('status_change', 'settings_update', 'report_export') then
    if not (public.has_role(uid, 'admin') or public.has_role(uid, 'super_admin')) then
      raise exception 'Audit action requires admin privileges' using errcode = '42501';
    end if;
  elsif p_action = 'role_change' then
    if not public.has_role(uid, 'super_admin') then
      raise exception 'role_change audit requires super_admin' using errcode = '42501';
    end if;
  else
    raise exception 'Audit action not allowed' using errcode = '42501';
  end if;

  safe_meta := coalesce(p_metadata, '{}'::jsonb)
    - 'password' - 'token' - 'access_token' - 'refresh_token' - 'service_role_key'
    - 'internal_note';

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, p_action, p_entity_type, coalesce(p_entity_id, uid), safe_meta)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.write_audit_log(public.audit_action, text, uuid, jsonb) from public;
grant execute on function public.write_audit_log(public.audit_action, text, uuid, jsonb) to authenticated;

-- Service-role safe webhook processor: skip write_audit_log when no uid
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
  if uid is not null and not public.is_staff(uid) then
    raise exception 'Staff or service only' using errcode = '42501';
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
      begin
        perform public.transition_release_status(
          p_release_id,
          target_status,
          'Provider webhook: ' || p_event_type,
          jsonb_build_object('source', 'webhook', 'event_id', p_event_id)
        );
      exception when others then
        update public.provider_webhook_events
        set process_status = 'failed',
            error_message = SQLERRM,
            processed_at = now(),
            job_id = job.id
        where id = ev.id
        returning * into ev;
        return ev;
      end;

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

  if uid is not null then
    perform public.write_audit_log(
      'distribution_webhook'::public.audit_action,
      'release',
      p_release_id,
      jsonb_build_object('event_id', p_event_id, 'event_type', p_event_type, 'mapped_status', p_mapped_status)
    );
  end if;

  return ev;
end;
$$;

revoke all on function public.process_provider_webhook_event(text, text, text, jsonb, boolean, uuid, text) from public;
grant execute on function public.process_provider_webhook_event(text, text, text, jsonb, boolean, uuid, text) to authenticated;
grant execute on function public.process_provider_webhook_event(text, text, text, jsonb, boolean, uuid, text) to service_role;

-- Owners may request takedown; staff path already covered. Allow owner audit via release_takedown_request.
create or replace function public.request_distribution_takedown(
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
  staff boolean;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  staff := public.is_staff(actor);
  if not staff and r.owner_user_id <> actor then
    raise exception 'Not permitted' using errcode = '42501';
  end if;

  r := public.transition_release_status(
    p_release_id,
    'takedown_requested',
    coalesce(p_reason, 'Takedown requested'),
    jsonb_build_object('source', 'request_distribution_takedown')
  );

  update public.distribution_jobs
  set status = 'takedown_requested', updated_at = now()
  where release_id = p_release_id
    and status in ('queued', 'submitting', 'submitted', 'syncing', 'delivered', 'live', 'failed');

  perform public.enqueue_distribution_email(
    p_release_id,
    'release_takedown_requested',
    jsonb_build_object('reason', p_reason)
  );

  if staff then
    perform public.write_audit_log(
      'distribution_takedown'::public.audit_action,
      'release',
      p_release_id,
      jsonb_build_object('reason', p_reason)
    );
  else
    perform public.write_audit_log(
      'release_takedown_request'::public.audit_action,
      'release',
      p_release_id,
      jsonb_build_object('reason', p_reason)
    );
  end if;

  return r;
end;
$$;

revoke all on function public.request_distribution_takedown(uuid, text) from public;
grant execute on function public.request_distribution_takedown(uuid, text) to authenticated;
