-- Batch 7 hostile closure: audit allowlist + PAID path hardening

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
    'distribution_retry', 'catalog_migration', 'catalog_mapping',
    'royalty_import', 'royalty_ledger_post', 'split_rule_change', 'statement_publish',
    'payout_create', 'payout_payment_op', 'payout_webhook', 'publishing_work_update',
    'publishing_share_change', 'fx_rate_unavailable', 'compliance_payout_hold'
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
  if actor is null or not (
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
  if not found then raise exception 'Payout not found' using errcode = 'P0002'; end if;
  if p.status = 'paid' then return p; end if;
  if p.status <> 'processing' then
    raise exception 'PAID only from PROCESSING (current=%)', p.status using errcode = 'P0001';
  end if;

  perform set_config('nexo.trusted_financial_transition', '1', true);

  update public.payouts set
    status = 'paid',
    payment_reference = trim(p_payment_reference),
    paid_at = now(),
    provider_name = provider,
    provider_payout_id = coalesce(p_provider_payout_id, provider_payout_id),
    updated_at = now()
  where id = p_payout_id
  returning * into p;

  perform set_config('nexo.trusted_financial_transition', '0', true);

  insert into public.ledger_accounts (owner_user_id, currency, label)
  values (p.owner_user_id, p.currency, 'default')
  on conflict (owner_user_id, currency, label) do nothing;
  select id into acct_id from public.ledger_accounts
  where owner_user_id = p.owner_user_id and currency = p.currency and label = 'default';

  insert into public.ledger_entries (
    account_id, owner_user_id, kind, amount_minor, currency, description,
    reference_type, reference_id, created_by, balance_bucket, payout_id, net_minor, gross_minor
  ) values (
    acct_id, p.owner_user_id, 'payout', -p.amount_minor, p.currency,
    'Payout ' || p.id::text, 'payout', p.id, actor, 'paid', p.id, -p.amount_minor, -p.amount_minor
  );

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor, 'payout_payment_op', 'payout', p.id,
    jsonb_build_object(
      'payment_reference', p.payment_reference,
      'provider_name', p.provider_name,
      'provider_payout_id', p.provider_payout_id
    )
  );

  insert into public.email_outbound_events (to_email, template_key, payload, status, related_entity_type, related_entity_id)
  select pr.email, 'payout_paid', jsonb_build_object('payout_id', p.id, 'payment_reference', p.payment_reference),
         'pending', 'payout', p.id
  from public.profiles pr where pr.id = p.owner_user_id and pr.email is not null;

  return p;
end;
$$;

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
  ev public.payout_webhook_events;
  p public.payouts;
  provider text := coalesce(nullif(trim(p_provider_name), ''), 'not_connected');
begin
  insert into public.payout_webhook_events (
    provider_name, event_id, event_type, payload, signature_valid, payout_id
  ) values (
    provider, p_event_id, p_event_type, coalesce(p_payload, '{}'::jsonb),
    coalesce(p_signature_valid, false), p_payout_id
  )
  on conflict (provider_name, event_id) do update
    set payload = excluded.payload
  returning * into ev;

  if ev.processed then return ev; end if;

  if not coalesce(p_signature_valid, false) then
    update public.payout_webhook_events
    set process_error = 'signature_invalid', processed = true
    where id = ev.id returning * into ev;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (null, 'payout_webhook', 'payout_webhook_event', ev.id,
            jsonb_build_object('ok', false, 'reason', 'signature_invalid'));
    return ev;
  end if;

  if provider = 'not_connected' then
    update public.payout_webhook_events
    set process_error = 'provider_not_connected', processed = true
    where id = ev.id returning * into ev;
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (null, 'payout_webhook', 'payout_webhook_event', ev.id,
            jsonb_build_object('ok', false, 'reason', 'provider_not_connected'));
    return ev;
  end if;

  if p_payout_id is not null and p_mapped_status = 'paid' and p_payment_reference is not null then
    select * into p from public.payouts where id = p_payout_id for update;
    if found and p.status = 'processing' then
      perform set_config('nexo.trusted_financial_transition', '1', true);
      update public.payouts set
        status = 'paid',
        payment_reference = trim(p_payment_reference),
        paid_at = now(),
        provider_name = provider,
        provider_payout_id = coalesce(provider_payout_id, p_event_id),
        updated_at = now()
      where id = p_payout_id;
      perform set_config('nexo.trusted_financial_transition', '0', true);
    end if;
  elsif p_payout_id is not null and p_mapped_status = 'failed' then
    update public.payouts set status = 'failed', failure_reason = coalesce(p_event_type, 'provider_failed'), updated_at = now()
    where id = p_payout_id and status = 'processing';
  end if;

  update public.payout_webhook_events
  set processed = true, payout_id = coalesce(p_payout_id, payout_id)
  where id = ev.id returning * into ev;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (null, 'payout_webhook', 'payout_webhook_event', ev.id,
          jsonb_build_object('ok', true, 'mapped_status', p_mapped_status));
  return ev;
end;
$$;
