-- Paddle Billing hardening: revoke client DML; keep SELECT for own/staff policies.
-- Service role bypasses RLS for webhook upserts.

revoke insert, update, delete on public.billing_customers from authenticated, anon;
revoke insert, update, delete on public.billing_subscriptions from authenticated, anon;
revoke insert, update, delete on public.billing_transactions from authenticated, anon;
revoke insert, update, delete on public.billing_webhook_events from authenticated, anon;
revoke insert, update, delete on public.billing_checkout_intents from authenticated, anon;

grant select on public.billing_customers to authenticated;
grant select on public.billing_subscriptions to authenticated;
grant select on public.billing_transactions to authenticated;
grant select on public.billing_webhook_events to authenticated;
grant select on public.billing_checkout_intents to authenticated;

grant all on public.billing_customers to service_role;
grant all on public.billing_subscriptions to service_role;
grant all on public.billing_transactions to service_role;
grant all on public.billing_webhook_events to service_role;
grant all on public.billing_checkout_intents to service_role;

comment on policy billing_customers_select_own on public.billing_customers is
  'Users read own billing customer; admin portal staff read all. No client writes.';
comment on policy billing_subscriptions_select_own on public.billing_subscriptions is
  'Users read own subscriptions; staff read all. Entitlements are not client-writable.';
