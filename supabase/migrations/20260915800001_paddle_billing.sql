-- NEXO Paddle Billing (Sandbox) — customers, subscriptions, transactions, webhook log.
-- Additive. Does not alter auth, payouts, DDEX, email, or catalog tables.
-- Entitlements are granted only from verified webhook / service-role writes.
-- Existing users are not locked out: no feature-flag columns on profiles.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- billing_customers
-- ---------------------------------------------------------------------------
create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_type text not null check (account_type in ('artist', 'label')),
  paddle_customer_id text not null,
  email text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paddle_customer_id),
  unique (user_id)
);

create index if not exists billing_customers_user_idx on public.billing_customers (user_id);

comment on table public.billing_customers is
  'Paddle customer mapping. Writes: service role / webhooks only. Users read own row.';

-- ---------------------------------------------------------------------------
-- billing_subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_type text not null check (account_type in ('artist', 'label')),
  paddle_subscription_id text not null,
  paddle_customer_id text not null,
  paddle_product_id text,
  paddle_price_id text,
  plan_id text,
  interval text check (interval is null or interval in ('month', 'year')),
  status text not null,
  collection_mode text,
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  scheduled_change_action text,
  scheduled_change_effective_at timestamptz,
  canceled_at timestamptz,
  paused_at timestamptz,
  custom_data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paddle_subscription_id)
);

create index if not exists billing_subscriptions_user_idx
  on public.billing_subscriptions (user_id, status);
create index if not exists billing_subscriptions_status_idx
  on public.billing_subscriptions (status);
create index if not exists billing_subscriptions_plan_idx
  on public.billing_subscriptions (plan_id);
create index if not exists billing_subscriptions_customer_idx
  on public.billing_subscriptions (paddle_customer_id);

comment on table public.billing_subscriptions is
  'Mirrored Paddle subscriptions. Paid access is derived in application code from status. Catalog rows are never deleted on billing change.';

-- ---------------------------------------------------------------------------
-- billing_transactions
-- ---------------------------------------------------------------------------
create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  paddle_transaction_id text not null,
  paddle_subscription_id text,
  paddle_customer_id text,
  paddle_price_id text,
  status text not null,
  origin text,
  currency text,
  totals jsonb not null default '{}'::jsonb,
  billed_at timestamptz,
  custom_data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paddle_transaction_id)
);

create index if not exists billing_transactions_user_idx
  on public.billing_transactions (user_id, created_at desc);
create index if not exists billing_transactions_status_idx
  on public.billing_transactions (status);

comment on table public.billing_transactions is
  'Mirrored Paddle transactions. Webhook/service-role writes only.';

-- ---------------------------------------------------------------------------
-- billing_webhook_events — idempotent by paddle event id
-- ---------------------------------------------------------------------------
create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  paddle_event_id text not null,
  event_type text not null,
  notification_id text,
  occurred_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  process_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (paddle_event_id)
);

create index if not exists billing_webhook_events_received_idx
  on public.billing_webhook_events (received_at desc);
create index if not exists billing_webhook_events_type_idx
  on public.billing_webhook_events (event_type);

comment on table public.billing_webhook_events is
  'Idempotent Paddle Billing webhook log keyed on evt_ IDs. Invalid signatures must not insert.';

-- ---------------------------------------------------------------------------
-- billing_checkout_intents — server-issued nonce so customData cannot spoof user id
-- ---------------------------------------------------------------------------
create table if not exists public.billing_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_type text not null check (account_type in ('artist', 'label')),
  plan_id text not null,
  interval text not null check (interval in ('month', 'year')),
  paddle_price_id text not null,
  status text not null default 'pending' check (status in ('pending', 'consumed', 'expired')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists billing_checkout_intents_user_idx
  on public.billing_checkout_intents (user_id, created_at desc);

comment on table public.billing_checkout_intents is
  'Short-lived server checkout intents. Browser never supplies userId/priceId; webhooks resolve via intent id.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_transactions enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.billing_checkout_intents enable row level security;

drop policy if exists billing_customers_select_own on public.billing_customers;
create policy billing_customers_select_own on public.billing_customers
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists billing_subscriptions_select_own on public.billing_subscriptions;
create policy billing_subscriptions_select_own on public.billing_subscriptions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists billing_transactions_select_own on public.billing_transactions;
create policy billing_transactions_select_own on public.billing_transactions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists billing_webhook_events_staff_select on public.billing_webhook_events;
create policy billing_webhook_events_staff_select on public.billing_webhook_events
  for select to authenticated
  using (public.is_admin_portal_staff(auth.uid()));

-- Checkout intents are not client-readable (contains price IDs + user binding).
-- Staff may inspect for support.
drop policy if exists billing_checkout_intents_staff_select on public.billing_checkout_intents;
create policy billing_checkout_intents_staff_select on public.billing_checkout_intents
  for select to authenticated
  using (public.is_admin_portal_staff(auth.uid()));

-- No client writes that mark paid / change paddle IDs / grant entitlements.
drop policy if exists billing_customers_no_client_write on public.billing_customers;
create policy billing_customers_no_client_write on public.billing_customers
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists billing_subscriptions_no_client_write on public.billing_subscriptions;
create policy billing_subscriptions_no_client_write on public.billing_subscriptions
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists billing_transactions_no_client_write on public.billing_transactions;
create policy billing_transactions_no_client_write on public.billing_transactions
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists billing_webhook_events_no_client_write on public.billing_webhook_events;
create policy billing_webhook_events_no_client_write on public.billing_webhook_events
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists billing_checkout_intents_no_client_write on public.billing_checkout_intents;
create policy billing_checkout_intents_no_client_write on public.billing_checkout_intents
  for all to authenticated
  using (false)
  with check (false);
