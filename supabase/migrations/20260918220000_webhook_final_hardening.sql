-- Final webhook hardening.
-- 1) Provider webhooks are service-role-only, idempotent, and tolerate repeated/same-status events.
-- 2) Payout webhooks are service-role-only; ordinary authenticated users cannot invoke the SECURITY DEFINER RPC.
-- 3) PAID webhook completion reuses the canonical payout completion path so ledger + email stay atomic.

create or replace function public.complete_payout_paid(
  p_payout_id uuid,
  p_payment_reference text,
  p_provider_name text default null,
  p_provider_payout_id text default null
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  p public.payouts;
  acct_id uuid;
  provider text := nullif(trim(coalesce(p_provider_name, '')), '');
begin
  -- Staff JWT or service_role. Ordinary authenticated users remain forbidden.
  if actor is not null and not (
    public.has_role(actor, 'admin') or public.has_role(actor, 'super_admin')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'payment_reference required' using errcode = 'P0001';
  end if;
  if provider is null or lower(provider) in ('not_connected', 'none', 'null') then
    raise exception 'PAID requires authorized provider path (provider_name)' using errcode = '42501';
  end if;

  select * into p from public.payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found' using errcode = 'P0002';
  end if;

  -- Idempotent: a retry after a committed PAID operation must not add another ledger row/email.
  if p.status = 'paid' then
    return p;
  end if;
  if p.status <> 'processing' then
    raise exception 'PAID only from PROCESSING (current=%)', p.status using errcode = 'P0001';
  end if;

  perform set_config('nexo.trusted_financial_transition', '1', true);
  begin
    update public.payouts
    set status = 'paid',
        payment_reference = trim(p_payment_reference),
        paid_at = now(),
        provider_name = provider,
        provider_payout_id = coalesce(nullif(trim(p_provider_payout_id), ''), provider_payout_id),
        updated_at = now()
    where id = p_payout_id
    returning * into p;
  exception when others then
    perform set_config('nexo.trusted_financial_transition', '0', true);
    raise;
  end;
  perform set_config('nexo.trusted_financial_transition', '0', true);

  insert into public.ledger_accounts (owner_user_id, currency, label)
  values (p.owner_user_id, p.currency, 'default')
  on conflict (owner_user_id, currency, label) do nothing;

  select id into acct_id
  from public.ledger_accounts
  where owner_user_id = p.owner_user_id
    and currency = p.currency
    and label = 'default';

  insert into public.ledger_entries (
    account_id, owner_user_id, kind, amount_minor, currency, description,
    reference_type, reference_id, created_by, balance_bucket, payout_id,
    net_minor, gross_minor
  ) values (
    acct_id, p.owner_user_id, 'payout', -p.amount_minor, p.currency,
    'Payout ' || p.id::text, 'payout', p.id, actor, 'paid', p.id,
    -p.amount_minor, -p.amount_minor
  );

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'payout_payment_op',
    'payout',
    p.id,
    jsonb_build_object(
      'payment_reference', p.payment_reference,
      'provider_name', p.provider_name,
      'provider_payout_id', p.provider_payout_id,
      'via', case when actor is null then 'service_role' else 'staff' end
    )
  );

  insert into public.email_outbound_events (
    to_email, template_key, payload, status, related_entity_type, related_entity_id
  )
  select
    pr.email,
    'payout_paid',
    jsonb_build_object(
      'payout_id', p.id,
      'payment_reference', p.payment_reference
    ),
    'pending',
    'payout',
    p.id
  from public.profiles pr
  where pr.id = p.owner_user_id
    and pr.email is not null;

  return p;
end;
$$;

revoke all on function public.complete_payout_paid(uuid, text, text, text) from public, anon;
grant execute on function public.complete_payout_paid(uuid, text, text, text) to authenticated, service_role;


create or replace function public.process_payout_webhook_event(
  p_provider_name text,
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_signature_valid boolean,
  p_payout_id uuid default null,
  p_payment_reference text default null,
  p_mapped_status text default null
)
returns public.payout_webhook_events
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.payout_webhook_events;
  existing public.payout_webhook_events;
  payout_row public.payouts;
  provider text := coalesce(nullif(trim(p_provider_name), ''), 'not_connected');
begin
  -- Webhook ingress must only be reachable through the server service client.
  if uid is not null then
    raise exception 'Service role only' using errcode = '42501';
  end if;

  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'event_id required' using errcode = 'P0001';
  end if;

  select * into existing
  from public.payout_webhook_events
  where provider_name = provider and event_id = trim(p_event_id)
  for update;

  if found then
    -- A committed valid event is fully idempotent. Invalid retries also remain rejected.
    if coalesce(existing.signature_valid, false) or not coalesce(p_signature_valid, false) then
      return existing;
    end if;

    -- A guessed invalid event id must not permanently block the later authentic event.
    update public.payout_webhook_events
    set event_type = p_event_type,
        payload = coalesce(p_payload, '{}'::jsonb),
        signature_valid = true,
        payout_id = coalesce(p_payout_id, payout_id),
        processed = false,
        process_error = null
    where id = existing.id
    returning * into ev;
  else
    insert into public.payout_webhook_events (
      provider_name, event_id, event_type, payload, signature_valid, payout_id
    ) values (
      provider, trim(p_event_id), p_event_type, coalesce(p_payload, '{}'::jsonb),
      coalesce(p_signature_valid, false), p_payout_id
    )
    returning * into ev;
  end if;

  if not coalesce(p_signature_valid, false) then
    update public.payout_webhook_events
    set process_error = 'signature_invalid', processed = true
    where id = ev.id
    returning * into ev;

    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (
      null, 'payout_webhook', 'payout_webhook_event', ev.id,
      jsonb_build_object('ok', false, 'reason', 'signature_invalid')
    );
    return ev;
  end if;

  if provider = 'not_connected' then
    update public.payout_webhook_events
    set process_error = 'provider_not_connected', processed = true
    where id = ev.id
    returning * into ev;
    return ev;
  end if;

  if p_payout_id is null then
    update public.payout_webhook_events
    set process_error = 'payout_not_resolved', processed = true
    where id = ev.id
    returning * into ev;
    return ev;
  end if;

  select * into payout_row
  from public.payouts
  where id = p_payout_id
  for update;

  if not found then
    update public.payout_webhook_events
    set process_error = 'payout_not_found', processed = true
    where id = ev.id
    returning * into ev;
    return ev;
  end if;

  if p_mapped_status = 'paid' then
    if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
      update public.payout_webhook_events
      set process_error = 'payment_reference_required', processed = true
      where id = ev.id
      returning * into ev;
      return ev;
    end if;

    -- Canonical completion is transactional: status + ledger + audit + email succeed together.
    perform public.complete_payout_paid(
      p_payout_id,
      p_payment_reference,
      provider,
      coalesce(nullif(trim(payout_row.provider_payout_id), ''), trim(p_event_id))
    );
  elsif p_mapped_status = 'failed' then
    if payout_row.status = 'processing' then
      perform set_config('nexo.trusted_financial_transition', '1', true);
      begin
        update public.payouts
        set status = 'failed',
            failure_reason = coalesce(nullif(trim(p_event_type), ''), 'provider_failed'),
            updated_at = now()
        where id = p_payout_id;
      exception when others then
        perform set_config('nexo.trusted_financial_transition', '0', true);
        raise;
      end;
      perform set_config('nexo.trusted_financial_transition', '0', true);
    end if;
  else
    update public.payout_webhook_events
    set process_error = 'status_unmapped', processed = true
    where id = ev.id
    returning * into ev;
    return ev;
  end if;

  update public.payout_webhook_events
  set processed = true,
      process_error = null,
      payout_id = p_payout_id
  where id = ev.id
  returning * into ev;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    null,
    'payout_webhook',
    'payout_webhook_event',
    ev.id,
    jsonb_build_object(
      'ok', true,
      'mapped_status', p_mapped_status,
      'provider_name', provider,
      'via', 'service_role'
    )
  );

  return ev;
end;
$$;

revoke all on function public.process_payout_webhook_event(text, text, text, jsonb, boolean, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.process_payout_webhook_event(text, text, text, jsonb, boolean, uuid, text, text)
  to service_role;


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
      case when p_signature_valid is distinct from true then 'failed' else 'received' end
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
