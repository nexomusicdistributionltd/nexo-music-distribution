-- NEXO Batch 7 hostile self-check fixes

-- Fix settings seed: store as JSON string for stable #>> reads
insert into public.admin_settings (key, value, updated_by)
values
  ('finance.min_payout_minor_usd', '"5000"'::jsonb, null),
  ('finance.payouts_enabled', '"true"'::jsonb, null)
on conflict (key) do update set value = excluded.value
where admin_settings.value is distinct from excluded.value;

-- Fix publish_royalty_statement notification columns (no metadata col)
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
      (period_start is not null and period_start >= p_period_start and coalesce(period_end, period_start) <= p_period_end)
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

  insert into public.royalty_line_items (
    statement_id, description, amount_minor, currency, kind, ledger_entry_id,
    release_id, track_id, dsp_code, territory, isrc, upc
  )
  select stmt.id,
         coalesce(le.description, le.kind::text),
         le.amount_minor, le.currency, le.kind, le.id, le.release_id, le.track_id,
         le.dsp_code, le.territory, le.isrc, le.upc
  from public.ledger_entries le
  where le.owner_user_id = p_owner_user_id and le.currency = upper(p_currency)
    and (
      (le.period_start is not null and le.period_start >= p_period_start and coalesce(le.period_end, le.period_start) <= p_period_end)
      or (le.period_start is null and le.created_at::date between p_period_start and p_period_end)
    );

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'statement_publish', 'royalty_statement', stmt.id,
          jsonb_build_object('period_start', p_period_start, 'period_end', p_period_end, 'currency', upper(p_currency)));

  insert into public.email_outbound_events (
    to_email, template_key, payload, status, related_entity_type, related_entity_id
  )
  select pr.email, 'royalty_statement_published',
         jsonb_build_object('statement_id', stmt.id),
         'pending', 'royalty_statement', stmt.id
  from public.profiles pr where pr.id = p_owner_user_id and pr.email is not null;

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  values (
    p_owner_user_id, 'royalty_statement', 'Royalty statement published',
    'A royalty statement is available for ' || p_period_start::text || ' – ' || p_period_end::text,
    'royalty_statement', stmt.id
  );

  return stmt;
end;
$$;

-- Block client UPDATE of ledger_entries even if someone adds a policy later
-- (trigger already blocks; reinforce revoke)
revoke insert, update, delete on public.ledger_entries from authenticated;
grant select on public.ledger_entries to authenticated;
grant select on public.ledger_balances to authenticated;

revoke insert, update, delete on public.payout_webhook_events from authenticated;
grant select on public.payout_webhook_events to authenticated;

-- Ensure ledger insert is RPC-only: drop any residual insert policies
drop policy if exists "ledger_entries_staff_insert" on public.ledger_entries;
drop policy if exists "ledger_entries_insert" on public.ledger_entries;

-- Extend audit allowlist for finance report types used by app
-- (report_exports allowlist is app-side)

-- Prevent publishing_collection_claims from being marked reported without provider
create or replace function public.protect_publishing_collection_claims()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'reported' and (new.source_provider is null or new.amount_minor is null or new.currency is null) then
    raise exception 'Cannot mark collection as reported without provider + amount + currency'
      using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and new.status = 'reported' and new.source_provider is null then
    raise exception 'No fake publishing collections' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists publishing_collection_claims_protect on public.publishing_collection_claims;
create trigger publishing_collection_claims_protect
  before insert or update on public.publishing_collection_claims
  for each row execute function public.protect_publishing_collection_claims();

-- Indexes for pagination
create index if not exists royalty_statements_status_idx
  on public.royalty_statements (status, period_end desc);
create index if not exists publishing_works_status_idx
  on public.publishing_works (registration_status, updated_at desc);
create index if not exists ledger_entries_created_idx
  on public.ledger_entries (created_at desc);
