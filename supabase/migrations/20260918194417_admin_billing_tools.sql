-- Admin billing tools: yearly/monthly manual grants and unpaid state.
-- Paddle remains the subscription/payment source of truth; this only extends
-- the separate Nexo administrative entitlement override table.

alter table public.billing_entitlement_overrides
  add column if not exists billing_interval text;

update public.billing_entitlement_overrides
set billing_interval = case
  when plan_id = 'artist_starter' then null
  else coalesce(billing_interval, 'month')
end;

alter table public.billing_entitlement_overrides
  drop constraint if exists billing_entitlement_overrides_status_check;

alter table public.billing_entitlement_overrides
  add constraint billing_entitlement_overrides_status_check
  check (status in ('active','trialing','past_due','expired','paused','canceled'));

alter table public.billing_entitlement_overrides
  drop constraint if exists billing_entitlement_overrides_billing_interval_check;

alter table public.billing_entitlement_overrides
  add constraint billing_entitlement_overrides_billing_interval_check
  check (
    (plan_id = 'artist_starter' and billing_interval is null)
    or
    (plan_id <> 'artist_starter' and billing_interval in ('month','year'))
  );

comment on column public.billing_entitlement_overrides.billing_interval is
  'Admin-granted paid plan interval. Paddle records remain unchanged.';

revoke all on public.billing_entitlement_overrides from anon, authenticated;
grant all on public.billing_entitlement_overrides to service_role;
