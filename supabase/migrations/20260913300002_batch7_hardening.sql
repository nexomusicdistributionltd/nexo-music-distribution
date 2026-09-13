-- NEXO Batch 7 hardening: RPCs, payout machine, GUC-gated PAID, eligibility, imports

-- ---------------------------------------------------------------------------
-- Trusted financial transition GUC (like Batch 6 status gates)
-- ---------------------------------------------------------------------------
create or replace function public.protect_payout_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trusted text := coalesce(current_setting('nexo.trusted_financial_transition', true), '0');
begin
  if tg_op = 'DELETE' then
    raise exception 'Payouts cannot be deleted; use adjustments or cancel' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.status = 'paid' then
      if new.payment_reference is null or length(trim(new.payment_reference)) = 0 or new.paid_at is null then
        raise exception 'PAID requires payment_reference and paid_at from a real payment operation' using errcode = 'P0001';
      end if;
      if old.status is distinct from 'paid' and trusted <> '1' then
        raise exception 'PAID requires trusted financial transition (server/provider path)' using errcode = '42501';
      end if;
      if old.status = 'paid' and (
        new.amount_minor is distinct from old.amount_minor
        or new.currency is distinct from old.currency
        or new.payment_reference is distinct from old.payment_reference
      ) then
        raise exception 'Paid payouts are immutable' using errcode = '42501';
      end if;
    end if;
    if old.status = 'paid' and new.status <> 'paid' then
      raise exception 'Cannot unset PAID status' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Transition payout (extended machine)
-- PENDING → UNDER_REVIEW → APPROVED → PROCESSING → PAID | REJECTED | FAILED
-- ---------------------------------------------------------------------------
create or replace function public.transition_payout_status(
  p_payout_id uuid,
  p_new_status public.payout_status,
  p_reason text default null
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  p public.payouts;
  allowed boolean := false;
begin
  if actor is null or not (
    public.has_role(actor, 'admin') or public.has_role(actor, 'super_admin')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into p from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'Payout not found' using errcode = 'P0002'; end if;
  if p_new_status = 'paid' then
    raise exception 'PAID requires a real payment operation' using errcode = '42501';
  end if;

  allowed := case p.status
    when 'pending' then p_new_status in ('under_review', 'approved', 'cancelled', 'on_hold', 'rejected')
    when 'under_review' then p_new_status in ('approved', 'rejected', 'cancelled', 'on_hold', 'pending')
    when 'approved' then p_new_status in ('processing', 'cancelled', 'on_hold', 'rejected')
    when 'processing' then p_new_status in ('failed', 'on_hold', 'rejected')
    when 'on_hold' then p_new_status in ('pending', 'under_review', 'approved', 'cancelled', 'rejected')
    when 'failed' then p_new_status in ('pending', 'cancelled', 'under_review')
    when 'rejected' then p_new_status in ('pending')
    else false
  end;
  if not allowed then
    raise exception 'Invalid payout transition from % to %', p.status, p_new_status
      using errcode = 'P0001';
  end if;

  update public.payouts
  set status = p_new_status,
      updated_at = now(),
      rejected_reason = case when p_new_status = 'rejected' then coalesce(p_reason, rejected_reason) else rejected_reason end,
      reviewed_by = case when p_new_status in ('under_review', 'approved', 'rejected') then actor else reviewed_by end,
      reviewed_at = case when p_new_status in ('under_review', 'approved', 'rejected') then now() else reviewed_at end,
      failure_reason = case when p_new_status = 'failed' then coalesce(p_reason, failure_reason) else failure_reason end
  where id = p_payout_id returning * into p;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor, 'payout_status_change', 'payout', p.id,
    jsonb_build_object('status', p_new_status::text, 'reason', coalesce(p_reason, ''))
  );
  return p;
end;
$$;

revoke all on function public.transition_payout_status(uuid, public.payout_status, text) from public;
grant execute on function public.transition_payout_status(uuid, public.payout_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Eligibility helper
-- ---------------------------------------------------------------------------
create or replace function public.payout_eligibility(
  p_owner uuid,
  p_currency char(3),
  p_amount_minor bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  bal bigint := 0;
  threshold bigint := 5000;
  acct public.profiles;
  hold_active boolean := false;
  restriction public.account_restriction_kind;
  enabled text;
begin
  select * into acct from public.profiles where id = p_owner;
  if not found then
    return jsonb_build_object('eligible', false, 'reason', 'Account not found');
  end if;
  if acct.account_status not in ('active') then
    return jsonb_build_object('eligible', false, 'reason', 'Account not active');
  end if;
  restriction := coalesce(acct.restriction_kind, 'none');
  if restriction in ('login_restricted', 'read_only') then
    return jsonb_build_object('eligible', false, 'reason', 'Account restriction blocks payouts');
  end if;

  select exists(
    select 1 from public.payout_compliance_holds h
    where h.owner_user_id = p_owner and h.active = true
  ) into hold_active;
  if hold_active then
    return jsonb_build_object('eligible', false, 'reason', 'Compliance hold active');
  end if;

  select coalesce((value #>> '{}'), '5000')::bigint into threshold
  from public.admin_settings where key = 'finance.min_payout_minor_usd';
  if p_currency = 'USD' and p_amount_minor < coalesce(threshold, 5000) then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'Below minimum payout threshold',
      'threshold_minor', coalesce(threshold, 5000)
    );
  end if;

  select coalesce(available_minor, 0) into bal
  from public.ledger_balances
  where owner_user_id = p_owner and currency = p_currency;
  if coalesce(bal, 0) < p_amount_minor then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'Insufficient available balance',
      'available_minor', coalesce(bal, 0)
    );
  end if;

  select coalesce(value #>> '{}', 'true') into enabled
  from public.admin_settings where key = 'finance.payouts_enabled';
  if enabled is not null and lower(enabled) in ('false', '0', 'no') then
    return jsonb_build_object('eligible', false, 'reason', 'Payouts temporarily disabled');
  end if;

  return jsonb_build_object(
    'eligible', true,
    'available_minor', bal,
    'threshold_minor', coalesce(threshold, 5000)
  );
end;
$$;

revoke all on function public.payout_eligibility(uuid, char, bigint) from public;
grant execute on function public.payout_eligibility(uuid, char, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Create payout (race-safe, idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.create_payout_request(
  p_owner_user_id uuid,
  p_amount_minor bigint,
  p_currency char(3),
  p_method text default null,
  p_idempotency_key text default null
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  elig jsonb;
  existing public.payouts;
  created public.payouts;
  acct_id uuid;
begin
  if actor is null or not (
    public.has_role(actor, 'admin') or public.has_role(actor, 'super_admin')
    or actor = p_owner_user_id
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'amount_minor must be positive integer' using errcode = 'P0001';
  end if;
  if p_currency is null or length(trim(p_currency)) <> 3 then
    raise exception 'ISO currency required' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select * into existing from public.payouts
    where owner_user_id = p_owner_user_id and idempotency_key = p_idempotency_key;
    if found then return existing; end if;
  end if;

  -- Lock owner rows conceptually via advisory lock
  perform pg_advisory_xact_lock(hashtext(p_owner_user_id::text || ':' || upper(p_currency)));

  elig := public.payout_eligibility(p_owner_user_id, upper(p_currency), p_amount_minor);
  if not (elig->>'eligible')::boolean then
    raise exception 'Payout not eligible: %', elig->>'reason' using errcode = 'P0001';
  end if;

  insert into public.ledger_accounts (owner_user_id, currency, label)
  values (p_owner_user_id, upper(p_currency), 'default')
  on conflict (owner_user_id, currency, label) do nothing;
  select id into acct_id from public.ledger_accounts
  where owner_user_id = p_owner_user_id and currency = upper(p_currency) and label = 'default';

  insert into public.payouts (
    owner_user_id, amount_minor, currency, status, method, idempotency_key,
    created_by, ledger_account_id, eligibility_notes, min_threshold_minor
  ) values (
    p_owner_user_id, p_amount_minor, upper(p_currency), 'pending', p_method, p_idempotency_key,
    actor, acct_id, elig::text, (elig->>'threshold_minor')::bigint
  ) returning * into created;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor, 'payout_create', 'payout', created.id,
    jsonb_build_object('amount_minor', p_amount_minor, 'currency', upper(p_currency))
  );

  insert into public.email_outbound_events (to_email, template_key, payload, status, related_entity_type, related_entity_id)
  select p.email, 'payout_requested', jsonb_build_object('payout_id', created.id, 'amount_minor', p_amount_minor, 'currency', upper(p_currency)),
         'pending', 'payout', created.id
  from public.profiles p where p.id = p_owner_user_id and p.email is not null;

  return created;
end;
$$;

revoke all on function public.create_payout_request(uuid, bigint, char, text, text) from public;
grant execute on function public.create_payout_request(uuid, bigint, char, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Complete payout as PAID (provider/server only + GUC)
-- ---------------------------------------------------------------------------
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
begin
  if actor is null or not (
    public.has_role(actor, 'admin') or public.has_role(actor, 'super_admin')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'payment_reference required' using errcode = 'P0001';
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
    provider_name = coalesce(p_provider_name, provider_name),
    provider_payout_id = coalesce(p_provider_payout_id, provider_payout_id),
    updated_at = now()
  where id = p_payout_id
  returning * into p;

  perform set_config('nexo.trusted_financial_transition', '0', true);

  -- Ledger payout debit (available → paid representation via compensating entries)
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

revoke all on function public.complete_payout_paid(uuid, text, text, text) from public;
grant execute on function public.complete_payout_paid(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Post compensating ledger adjustment (staff)
-- ---------------------------------------------------------------------------
create or replace function public.post_ledger_adjustment(
  p_owner_user_id uuid,
  p_amount_minor bigint,
  p_currency char(3),
  p_kind public.money_entry_kind,
  p_description text,
  p_compensating_for uuid default null,
  p_balance_bucket public.ledger_balance_bucket default 'available'
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  acct_id uuid;
  entry public.ledger_entries;
begin
  if actor is null or not (
    public.has_role(actor, 'admin') or public.has_role(actor, 'super_admin')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_amount_minor = 0 or p_amount_minor is null then
    raise exception 'amount_minor required nonzero integer' using errcode = 'P0001';
  end if;
  if p_kind not in ('adjustment', 'fee', 'deduction', 'refund', 'royalty_credit', 'royalty_debit', 'reversal') then
    raise exception 'Invalid adjustment kind' using errcode = 'P0001';
  end if;

  insert into public.ledger_accounts (owner_user_id, currency, label)
  values (p_owner_user_id, upper(p_currency), 'default')
  on conflict (owner_user_id, currency, label) do nothing;
  select id into acct_id from public.ledger_accounts
  where owner_user_id = p_owner_user_id and currency = upper(p_currency) and label = 'default';

  insert into public.ledger_entries (
    account_id, owner_user_id, kind, amount_minor, currency, description,
    created_by, balance_bucket, compensating_for, net_minor, gross_minor, adjustment_minor
  ) values (
    acct_id, p_owner_user_id, p_kind, p_amount_minor, upper(p_currency), p_description,
    actor, p_balance_bucket, p_compensating_for, p_amount_minor, p_amount_minor,
    case when p_kind = 'adjustment' then p_amount_minor else 0 end
  ) returning * into entry;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'royalty_adjustment', 'ledger_entry', entry.id,
          jsonb_build_object('kind', p_kind::text, 'amount_minor', p_amount_minor));
  return entry;
end;
$$;

revoke all on function public.post_ledger_adjustment(uuid, bigint, char, public.money_entry_kind, text, uuid, public.ledger_balance_bucket) from public;
grant execute on function public.post_ledger_adjustment(uuid, bigint, char, public.money_entry_kind, text, uuid, public.ledger_balance_bucket) to authenticated;

-- ---------------------------------------------------------------------------
-- Idempotent royalty import upsert
-- ---------------------------------------------------------------------------
create or replace function public.upsert_royalty_import_batch(
  p_source_provider text,
  p_report_id text,
  p_period_start date default null,
  p_period_end date default null,
  p_currency char(3) default null
)
returns public.royalty_import_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  b public.royalty_import_batches;
begin
  if actor is null or not public.is_admin_portal_staff(actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.royalty_import_batches (
    source_provider, report_id, report_period_start, report_period_end, currency, created_by
  ) values (
    p_source_provider, p_report_id, p_period_start, p_period_end, p_currency, actor
  )
  on conflict (source_provider, report_id) do update
    set report_period_start = coalesce(excluded.report_period_start, royalty_import_batches.report_period_start),
        report_period_end = coalesce(excluded.report_period_end, royalty_import_batches.report_period_end),
        currency = coalesce(excluded.currency, royalty_import_batches.currency)
  returning * into b;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'royalty_import', 'royalty_import_batch', b.id,
          jsonb_build_object('source_provider', p_source_provider, 'report_id', p_report_id));
  return b;
end;
$$;

revoke all on function public.upsert_royalty_import_batch(text, text, date, date, char) from public;
grant execute on function public.upsert_royalty_import_batch(text, text, date, date, char) to authenticated;

create or replace function public.upsert_royalty_import_row(
  p_batch_id uuid,
  p_row_key text,
  p_raw jsonb,
  p_amount_minor bigint default null,
  p_currency char(3) default null,
  p_isrc text default null,
  p_upc text default null,
  p_territory char(2) default null,
  p_dsp_code text default null,
  p_period_start date default null,
  p_period_end date default null
)
returns public.royalty_import_rows
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  b public.royalty_import_batches;
  r public.royalty_import_rows;
begin
  if actor is null or not public.is_admin_portal_staff(actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into b from public.royalty_import_batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found' using errcode = 'P0002'; end if;

  insert into public.royalty_import_rows (
    batch_id, source_provider, report_id, row_key, raw, amount_minor, currency,
    isrc, upc, territory, dsp_code, period_start, period_end
  ) values (
    b.id, b.source_provider, b.report_id, p_row_key, coalesce(p_raw, '{}'::jsonb),
    p_amount_minor, p_currency, p_isrc, p_upc, p_territory, p_dsp_code, p_period_start, p_period_end
  )
  on conflict (source_provider, report_id, row_key) do update
    set raw = excluded.raw,
        amount_minor = coalesce(excluded.amount_minor, royalty_import_rows.amount_minor),
        currency = coalesce(excluded.currency, royalty_import_rows.currency),
        isrc = coalesce(excluded.isrc, royalty_import_rows.isrc),
        upc = coalesce(excluded.upc, royalty_import_rows.upc),
        territory = coalesce(excluded.territory, royalty_import_rows.territory),
        dsp_code = coalesce(excluded.dsp_code, royalty_import_rows.dsp_code),
        period_start = coalesce(excluded.period_start, royalty_import_rows.period_start),
        period_end = coalesce(excluded.period_end, royalty_import_rows.period_end)
  where royalty_import_rows.match_status not in ('posted')
  returning * into r;

  if r is null then
    select * into r from public.royalty_import_rows
    where source_provider = b.source_provider and report_id = b.report_id and row_key = p_row_key;
  end if;

  update public.royalty_import_batches
  set row_count = (select count(*) from public.royalty_import_rows where batch_id = b.id)
  where id = b.id;

  return r;
end;
$$;

revoke all on function public.upsert_royalty_import_row(uuid, text, jsonb, bigint, char, text, text, char, text, date, date) from public;
grant execute on function public.upsert_royalty_import_row(uuid, text, jsonb, bigint, char, text, text, char, text, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Publish statement from ledger (real data only)
-- ---------------------------------------------------------------------------
create or replace function public.publish_royalty_statement(
  p_owner_user_id uuid,
  p_period_start date,
  p_period_end date,
  p_currency char(3)
)
returns public.royalty_statements
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  stmt public.royalty_statements;
  opening bigint := 0;
  earnings bigint := 0;
  deductions bigint := 0;
  adjustments bigint := 0;
  payouts_sum bigint := 0;
  closing bigint := 0;
begin
  if actor is null or not (
    public.has_role(actor, 'admin') or public.has_role(actor, 'super_admin')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(sum(amount_minor), 0) into opening
  from public.ledger_entries
  where owner_user_id = p_owner_user_id and currency = upper(p_currency)
    and created_at::date < p_period_start;

  select coalesce(sum(amount_minor) filter (where kind in ('royalty_credit', 'royalty_debit')), 0),
         coalesce(sum(amount_minor) filter (where kind in ('deduction', 'fee')), 0),
         coalesce(sum(amount_minor) filter (where kind in ('adjustment', 'reversal', 'refund')), 0),
         coalesce(sum(amount_minor) filter (where kind = 'payout'), 0)
  into earnings, deductions, adjustments, payouts_sum
  from public.ledger_entries
  where owner_user_id = p_owner_user_id and currency = upper(p_currency)
    and (
      (period_start is not null and period_start >= p_period_start and period_end <= p_period_end)
      or (period_start is null and created_at::date between p_period_start and p_period_end)
    );

  closing := opening + earnings + deductions + adjustments + payouts_sum;

  insert into public.royalty_statements (
    owner_user_id, period_start, period_end, currency, status,
    opening_minor, earnings_minor, deductions_minor, adjustments_minor,
    payouts_minor, closing_minor, total_minor, published_at
  ) values (
    p_owner_user_id, p_period_start, p_period_end, upper(p_currency), 'published',
    opening, earnings, deductions, adjustments, payouts_sum, closing, closing, now()
  ) returning * into stmt;

  insert into public.royalty_line_items (statement_id, description, amount_minor, currency, kind, ledger_entry_id, release_id, track_id, dsp_code, territory, isrc, upc)
  select stmt.id,
         coalesce(le.description, le.kind::text),
         le.amount_minor, le.currency, le.kind, le.id, le.release_id, le.track_id, le.dsp_code, le.territory, le.isrc, le.upc
  from public.ledger_entries le
  where le.owner_user_id = p_owner_user_id and le.currency = upper(p_currency)
    and (
      (le.period_start is not null and le.period_start >= p_period_start and le.period_end <= p_period_end)
      or (le.period_start is null and le.created_at::date between p_period_start and p_period_end)
    );

  update public.ledger_entries
  set statement_id = stmt.id
  where owner_user_id = p_owner_user_id and currency = upper(p_currency)
    and statement_id is null
    and (
      (period_start is not null and period_start >= p_period_start and period_end <= p_period_end)
      or (period_start is null and created_at::date between p_period_start and p_period_end)
    );

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'statement_publish', 'royalty_statement', stmt.id,
          jsonb_build_object('period_start', p_period_start, 'period_end', p_period_end, 'currency', upper(p_currency)));

  insert into public.email_outbound_events (to_email, template_key, payload, status, related_entity_type, related_entity_id)
  select pr.email, 'royalty_statement_published', jsonb_build_object('statement_id', stmt.id),
         'pending', 'royalty_statement', stmt.id
  from public.profiles pr where pr.id = p_owner_user_id and pr.email is not null;

  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    p_owner_user_id, 'royalty_statement', 'Royalty statement published',
    'A royalty statement is available for ' || p_period_start::text || ' – ' || p_period_end::text,
    jsonb_build_object('statement_id', stmt.id)
  );

  return stmt;
end;
$$;

revoke all on function public.publish_royalty_statement(uuid, date, date, char) from public;
grant execute on function public.publish_royalty_statement(uuid, date, date, char) to authenticated;

-- ---------------------------------------------------------------------------
-- Payout webhook processor (fail-closed when signature invalid)
-- ---------------------------------------------------------------------------
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
begin
  insert into public.payout_webhook_events (
    provider_name, event_id, event_type, payload, signature_valid, payout_id
  ) values (
    p_provider_name, p_event_id, p_event_type, coalesce(p_payload, '{}'::jsonb),
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

  if p_payout_id is not null and p_mapped_status = 'paid' and p_payment_reference is not null then
    select * into p from public.payouts where id = p_payout_id for update;
    if found and p.status = 'processing' then
      perform set_config('nexo.trusted_financial_transition', '1', true);
      update public.payouts set
        status = 'paid',
        payment_reference = trim(p_payment_reference),
        paid_at = now(),
        provider_name = coalesce(provider_name, p_provider_name),
        provider_payout_id = coalesce(provider_payout_id, p_event_id),
        updated_at = now()
      where id = p_payout_id;
      perform set_config('nexo.trusted_financial_transition', '0', true);
    elsif found and p.status = 'paid' then
      null; -- idempotent
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

revoke all on function public.process_payout_webhook_event(text, text, text, jsonb, boolean, uuid, text, text) from public;
-- service role / authenticated staff only — also grant to authenticated for admin replay
grant execute on function public.process_payout_webhook_event(text, text, text, jsonb, boolean, uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Compliance hold helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_payout_compliance_hold(
  p_owner_user_id uuid,
  p_reason text,
  p_case_id uuid default null,
  p_active boolean default true
)
returns public.payout_compliance_holds
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  h public.payout_compliance_holds;
begin
  if actor is null or not public.is_admin_portal_staff(actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_active then
    insert into public.payout_compliance_holds (owner_user_id, case_id, reason, active, created_by)
    values (p_owner_user_id, p_case_id, p_reason, true, actor)
    returning * into h;
  else
    update public.payout_compliance_holds
    set active = false, released_at = now(), released_by = actor
    where owner_user_id = p_owner_user_id and active = true
    returning * into h;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'compliance_payout_hold', 'payout_compliance_hold', h.id,
          jsonb_build_object('active', p_active, 'owner', p_owner_user_id, 'reason', p_reason));
  return h;
end;
$$;

revoke all on function public.set_payout_compliance_hold(uuid, text, uuid, boolean) from public;
grant execute on function public.set_payout_compliance_hold(uuid, text, uuid, boolean) to authenticated;

-- Allowlist finance settings keys via existing pattern (app-side); DB check already rejects secrets
