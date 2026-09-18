-- Canonical payout balance reservation.
-- Open/paid payouts reduce spendable available balance so requests cannot oversubscribe royalties.
create or replace view public.ledger_balances
with (security_invoker = true)
as
with ledger as (
  select
    owner_user_id,
    currency,
    coalesce(sum(amount_minor) filter (where balance_bucket = 'available'), 0)::bigint as raw_available_minor,
    coalesce(sum(amount_minor) filter (where balance_bucket = 'pending'), 0)::bigint as pending_minor,
    coalesce(sum(amount_minor) filter (where balance_bucket = 'paid'), 0)::bigint as paid_minor,
    coalesce(sum(amount_minor) filter (where balance_bucket = 'held'), 0)::bigint as held_minor,
    coalesce(sum(amount_minor), 0)::bigint as total_minor
  from public.ledger_entries
  group by owner_user_id, currency
),
reserved as (
  select
    owner_user_id,
    currency,
    coalesce(sum(amount_minor) filter (
      where status in ('pending','approved','processing','on_hold','paid')
    ), 0)::bigint as reserved_minor
  from public.payouts
  group by owner_user_id, currency
)
select
  l.owner_user_id,
  l.currency,
  greatest(l.raw_available_minor - coalesce(r.reserved_minor, 0), 0)::bigint as available_minor,
  l.pending_minor,
  l.paid_minor,
  l.held_minor,
  l.total_minor,
  coalesce(r.reserved_minor, 0)::bigint as reserved_payout_minor
from ledger l
left join reserved r
  on r.owner_user_id = l.owner_user_id
 and r.currency = l.currency;

comment on view public.ledger_balances is
  'Derived balances. available_minor excludes pending/approved/processing/on_hold/paid payout amounts to prevent double withdrawal.';
