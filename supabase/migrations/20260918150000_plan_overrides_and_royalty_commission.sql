-- Nexo plan overrides + royalty commission policy.
-- Paid plans: Nexo 10% / owner 90%. Free/no-paid-access: Nexo 20% / owner 80%.
-- Admin overrides are deliberately separate from Paddle truth.

create table if not exists public.billing_entitlement_overrides (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  account_type text not null check (account_type in ('artist','label')),
  plan_id text not null check (plan_id in ('artist_starter','artist_pro','label_starter','label_pro')),
  status text not null check (status in ('active','trialing','expired','paused','canceled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (account_type='artist' and plan_id in ('artist_starter','artist_pro'))
    or (account_type='label' and plan_id in ('label_starter','label_pro'))
  )
);
alter table public.billing_entitlement_overrides enable row level security;
revoke all on public.billing_entitlement_overrides from anon, authenticated;
grant all on public.billing_entitlement_overrides to service_role;

create table if not exists public.royalty_commission_policy (
  id text primary key default 'default' check (id='default'),
  paid_plan_bps integer not null default 1000 check (paid_plan_bps between 0 and 10000),
  free_plan_bps integer not null default 2000 check (free_plan_bps between 0 and 10000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.royalty_commission_policy(id,paid_plan_bps,free_plan_bps)
values ('default',1000,2000) on conflict (id) do update set paid_plan_bps=1000,free_plan_bps=2000;
alter table public.royalty_commission_policy enable row level security;
revoke all on public.royalty_commission_policy from anon, authenticated;
grant all on public.royalty_commission_policy to service_role;

alter table public.royalty_import_rows
  add column if not exists gross_amount_minor bigint,
  add column if not exists commission_bps integer check (commission_bps is null or commission_bps between 0 and 10000),
  add column if not exists commission_minor bigint,
  add column if not exists owner_net_minor bigint;

comment on table public.billing_entitlement_overrides is 'Admin-issued plan access. Never mutates or impersonates Paddle subscription records.';
comment on table public.royalty_commission_policy is 'Nexo master royalty commission: 10% paid plans, 20% free plans.';
