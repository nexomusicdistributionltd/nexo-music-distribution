-- Nexo global Artist/Label payout engine.
-- Additive reconciliation only: preserves existing royalty ledger, statements, SplitShare,
-- recoupments, billing, identity verification, provider/webhook, and payout history.

-- ---------------------------------------------------------------------------
-- Configurable provider / country / currency / route model
-- ---------------------------------------------------------------------------
create table if not exists public.payout_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{2,60}$'),
  name text not null,
  enabled boolean not null default false,
  manual_payout_enabled boolean not null default false,
  api_enabled boolean not null default false,
  bulk_payout_supported boolean not null default false,
  priority integer not null default 100,
  maintenance_mode boolean not null default false,
  api_credentials_configured boolean not null default false,
  webhook_configured boolean not null default false,
  last_connection_test_at timestamptz,
  last_connection_test_status text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payout_countries (
  iso2 char(2) primary key check (iso2 ~ '^[A-Z]{2}$'),
  iso3 char(3) not null unique check (iso3 ~ '^[A-Z]{3}$'),
  name text not null,
  flag text,
  calling_code text,
  enabled boolean not null default false,
  individual_enabled boolean not null default true,
  business_enabled boolean not null default true,
  identity_verification_required boolean not null default false,
  tax_information_required boolean not null default false,
  bank_verification_required boolean not null default false,
  minimum_payout_minor bigint,
  maximum_payout_minor bigint,
  security_hold_minutes integer,
  notes text,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now(),
  constraint payout_country_limits check (
    (minimum_payout_minor is null or minimum_payout_minor >= 0)
    and (maximum_payout_minor is null or maximum_payout_minor > 0)
    and (
      minimum_payout_minor is null or maximum_payout_minor is null
      or maximum_payout_minor >= minimum_payout_minor
    )
  )
);

create table if not exists public.payout_currencies (
  code char(3) primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  symbol text not null,
  decimal_precision smallint not null default 2 check (decimal_precision between 0 and 4),
  enabled boolean not null default false,
  settlement_currency char(3),
  fx_enabled boolean not null default false,
  fx_fee_bps integer not null default 0 check (fx_fee_bps between 0 and 10000),
  nexo_fx_markup_bps integer not null default 0 check (nexo_fx_markup_bps between 0 and 10000),
  fx_fee_payer text not null default 'recipient' check (fx_fee_payer in ('nexo','recipient','split')),
  fx_split_recipient_bps integer not null default 5000 check (fx_split_recipient_bps between 0 and 10000),
  minimum_payout_minor bigint,
  maximum_payout_minor bigint,
  processing_time_text text,
  updated_at timestamptz not null default now(),
  constraint payout_currency_limits check (
    (minimum_payout_minor is null or minimum_payout_minor >= 0)
    and (maximum_payout_minor is null or maximum_payout_minor > 0)
    and (
      minimum_payout_minor is null or maximum_payout_minor is null
      or maximum_payout_minor >= minimum_payout_minor
    )
  )
);

create table if not exists public.payout_method_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{2,60}$'),
  name text not null,
  icon text,
  enabled boolean not null default true,
  maintenance_mode boolean not null default false,
  processing_time_text text,
  display_order integer not null default 100,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.payout_provider_routes (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null references public.payout_countries(iso2) on delete cascade,
  currency_code char(3) not null references public.payout_currencies(code) on delete cascade,
  method_id uuid not null references public.payout_method_catalog(id) on delete cascade,
  beneficiary_type text not null check (beneficiary_type in ('individual','business')),
  provider_id uuid not null references public.payout_providers(id) on delete restrict,
  priority integer not null default 100,
  is_backup boolean not null default false,
  enabled boolean not null default true,
  minimum_payout_minor bigint,
  maximum_payout_minor bigint,
  identity_verification_required boolean not null default false,
  tax_information_required boolean not null default false,
  bank_verification_required boolean not null default false,
  processing_time_text text,
  maintenance_message text,
  updated_at timestamptz not null default now(),
  unique (country_code, currency_code, method_id, beneficiary_type, provider_id),
  constraint payout_route_limits check (
    (minimum_payout_minor is null or minimum_payout_minor >= 0)
    and (maximum_payout_minor is null or maximum_payout_minor > 0)
    and (
      minimum_payout_minor is null or maximum_payout_minor is null
      or maximum_payout_minor >= minimum_payout_minor
    )
  )
);

create index if not exists payout_routes_lookup_idx
  on public.payout_provider_routes
  (country_code, currency_code, beneficiary_type, method_id, enabled, priority);

create table if not exists public.payout_method_fields (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null references public.payout_countries(iso2) on delete cascade,
  currency_code char(3) not null references public.payout_currencies(code) on delete cascade,
  method_id uuid not null references public.payout_method_catalog(id) on delete cascade,
  beneficiary_type text not null check (beneficiary_type in ('individual','business')),
  field_key text not null check (field_key ~ '^[a-z0-9_]{2,80}$'),
  display_label text not null,
  input_type text not null check (
    input_type in (
      'text','number','select','phone','email','textarea','checkbox','radio',
      'country','currency','bank_selector','mobile_network_selector'
    )
  ),
  required boolean not null default false,
  placeholder text,
  help_text text,
  minimum_length integer,
  maximum_length integer,
  validation_regex text,
  numeric_only boolean not null default false,
  display_order integer not null default 100,
  encrypted boolean not null default false,
  masked boolean not null default false,
  enabled boolean not null default true,
  options jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (country_code, currency_code, method_id, beneficiary_type, field_key),
  constraint payout_field_lengths check (
    (minimum_length is null or minimum_length >= 0)
    and (maximum_length is null or maximum_length >= 1)
    and (
      minimum_length is null or maximum_length is null
      or maximum_length >= minimum_length
    )
  )
);

create index if not exists payout_method_fields_route_idx
  on public.payout_method_fields
  (country_code, currency_code, method_id, beneficiary_type, display_order)
  where enabled = true;

create table if not exists public.payout_mobile_networks (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null references public.payout_countries(iso2) on delete cascade,
  code text not null,
  name text not null,
  enabled boolean not null default true,
  display_order integer not null default 100,
  unique (country_code, code)
);

create table if not exists public.payout_fee_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fee_kind text not null default 'nexo' check (fee_kind in ('nexo','provider')),
  account_type text check (account_type in ('artist','label')),
  plan_segment text check (plan_segment in ('free','paid')),
  country_code char(2) references public.payout_countries(iso2) on delete cascade,
  currency_code char(3) references public.payout_currencies(code) on delete cascade,
  method_id uuid references public.payout_method_catalog(id) on delete cascade,
  provider_id uuid references public.payout_providers(id) on delete cascade,
  fixed_fee_minor bigint not null default 0 check (fixed_fee_minor >= 0),
  percentage_bps integer not null default 0 check (percentage_bps between 0 and 10000),
  fee_payer text not null default 'recipient' check (fee_payer in ('nexo','recipient','split')),
  split_recipient_bps integer not null default 5000 check (split_recipient_bps between 0 and 10000),
  enabled boolean not null default true,
  priority integer not null default 100,
  updated_at timestamptz not null default now()
);

create index if not exists payout_fee_rules_match_idx
  on public.payout_fee_rules (enabled, fee_kind, currency_code, country_code, priority);

create table if not exists public.payout_limit_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type text check (account_type in ('artist','label')),
  plan_segment text check (plan_segment in ('free','paid')),
  country_code char(2) references public.payout_countries(iso2) on delete cascade,
  currency_code char(3) references public.payout_currencies(code) on delete cascade,
  method_id uuid references public.payout_method_catalog(id) on delete cascade,
  provider_id uuid references public.payout_providers(id) on delete cascade,
  minimum_payout_minor bigint,
  maximum_payout_minor bigint,
  daily_maximum_minor bigint,
  weekly_maximum_minor bigint,
  monthly_maximum_minor bigint,
  daily_request_count integer,
  weekly_request_count integer,
  monthly_request_count integer,
  enabled boolean not null default true,
  priority integer not null default 100,
  updated_at timestamptz not null default now(),
  constraint payout_limit_rule_values check (
    (minimum_payout_minor is null or minimum_payout_minor >= 0)
    and (maximum_payout_minor is null or maximum_payout_minor > 0)
    and (daily_maximum_minor is null or daily_maximum_minor > 0)
    and (weekly_maximum_minor is null or weekly_maximum_minor > 0)
    and (monthly_maximum_minor is null or monthly_maximum_minor > 0)
    and (daily_request_count is null or daily_request_count > 0)
    and (weekly_request_count is null or weekly_request_count > 0)
    and (monthly_request_count is null or monthly_request_count > 0)
  )
);

create table if not exists public.payout_security_settings (
  id text primary key default 'default',
  method_change_hold_enabled boolean not null default false,
  method_change_hold_minutes integer not null default 0 check (method_change_hold_minutes >= 0),
  require_identity_verification boolean not null default false,
  tax_information_can_block boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.payout_security_settings(id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.payout_fx_rates (
  id uuid primary key default gen_random_uuid(),
  source_currency char(3) not null references public.payout_currencies(code) on delete cascade,
  destination_currency char(3) not null references public.payout_currencies(code) on delete cascade,
  rate_numerator bigint not null check (rate_numerator > 0),
  rate_denominator bigint not null check (rate_denominator > 0),
  source text not null default 'admin',
  enabled boolean not null default true,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint payout_fx_distinct_currencies check (source_currency <> destination_currency),
  constraint payout_fx_expiration check (expires_at is null or expires_at > effective_at)
);

create index if not exists payout_fx_rate_lookup_idx
  on public.payout_fx_rates (source_currency, destination_currency, enabled, effective_at desc);

-- ---------------------------------------------------------------------------
-- Extend saved payout methods. Sensitive destination values are encrypted by
-- server-only application code; client-visible columns contain masks only.
-- ---------------------------------------------------------------------------
alter table public.payout_methods
  add column if not exists route_method_id uuid references public.payout_method_catalog(id) on delete set null,
  add column if not exists beneficiary_type text,
  add column if not exists encrypted_details text,
  add column if not exists destination_mask text,
  add column if not exists institution_name text,
  add column if not exists public_details jsonb not null default '{}'::jsonb,
  add column if not exists last_sensitive_change_at timestamptz,
  add column if not exists security_hold_until timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_reference text;

do $$
begin
  alter table public.payout_methods drop constraint if exists payout_methods_method_type_check;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.payout_methods'::regclass
      and conname='payout_methods_method_type_dynamic_check'
  ) then
    alter table public.payout_methods
      add constraint payout_methods_method_type_dynamic_check
      check (
        method_type in (
          'bank_transfer','ach','wire','sepa','greytag','mobile_money',
          'manual_bank_transfer','paypal','payoneer','other'
        )
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.payout_methods'::regclass
      and conname='payout_methods_beneficiary_type_check'
  ) then
    alter table public.payout_methods
      add constraint payout_methods_beneficiary_type_check
      check (beneficiary_type is null or beneficiary_type in ('individual','business'));
  end if;
end $$;

update public.payout_methods pm
set destination_mask = coalesce(pm.destination_mask, nullif(pm.details->>'destination_mask','')),
    institution_name = coalesce(pm.institution_name, nullif(pm.details->>'institution','')),
    beneficiary_type = coalesce(
      pm.beneficiary_type,
      case when p.account_type='label' then 'business' else 'individual' end
    )
from public.profiles p
where p.id=pm.user_id
  and (
    pm.destination_mask is null
    or pm.institution_name is null
    or pm.beneficiary_type is null
  );

update public.payout_methods pm
set route_method_id = mc.id
from public.payout_method_catalog mc
where pm.route_method_id is null
  and mc.code = pm.method_type;

create index if not exists payout_methods_route_idx
  on public.payout_methods(user_id, country_code, currency, route_method_id, status);

-- Payout method security hold is applied whenever encrypted destination data changes.
create or replace function public.apply_payout_method_security_hold()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  cfg public.payout_security_settings;
  hold_minutes integer := 0;
begin
  if tg_op='INSERT' or new.encrypted_details is distinct from old.encrypted_details then
    select * into cfg from public.payout_security_settings where id='default';
    hold_minutes := case
      when cfg.method_change_hold_enabled then cfg.method_change_hold_minutes
      else 0
    end;
    if new.country_code is not null then
      select coalesce(pc.security_hold_minutes, hold_minutes)
      into hold_minutes
      from public.payout_countries pc
      where pc.iso2=new.country_code;
    end if;
    new.last_sensitive_change_at := now();
    new.security_hold_until := case
      when coalesce(hold_minutes,0) > 0 then now() + make_interval(mins => hold_minutes)
      else null
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists payout_methods_apply_security_hold on public.payout_methods;
create trigger payout_methods_apply_security_hold
before insert or update of encrypted_details on public.payout_methods
for each row execute function public.apply_payout_method_security_hold();

create or replace function public.protect_payout_method_disable()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='UPDATE'
     and new.status='disabled'
     and old.status is distinct from 'disabled'
     and exists (
       select 1 from public.payouts p
       where p.payout_method_id=old.id
         and p.status in ('pending','under_review','approved','processing','on_hold')
     )
  then
    raise exception 'Payout method is attached to an active payout' using errcode='P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists payout_methods_protect_active on public.payout_methods;
create trigger payout_methods_protect_active
before update of status on public.payout_methods
for each row execute function public.protect_payout_method_disable();

-- ---------------------------------------------------------------------------
-- Payout lifecycle snapshots / references / events / payment records
-- ---------------------------------------------------------------------------
create sequence if not exists public.nexo_payout_reference_seq start 1;

alter table public.payouts
  add column if not exists payout_reference text,
  add column if not exists route_id uuid references public.payout_provider_routes(id) on delete set null,
  add column if not exists provider_id uuid references public.payout_providers(id) on delete set null,
  add column if not exists account_type text,
  add column if not exists beneficiary_type text,
  add column if not exists country_code char(2),
  add column if not exists source_currency char(3),
  add column if not exists destination_currency char(3),
  add column if not exists gross_amount_minor bigint,
  add column if not exists provider_fee_minor bigint not null default 0,
  add column if not exists nexo_fee_minor bigint not null default 0,
  add column if not exists fx_fee_minor bigint not null default 0,
  add column if not exists fx_rate_numerator bigint,
  add column if not exists fx_rate_denominator bigint,
  add column if not exists net_amount_minor bigint,
  add column if not exists available_balance_at_request_minor bigint,
  add column if not exists requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists processing_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists returned_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists provider_transaction_id text,
  add column if not exists failure_code text,
  add column if not exists admin_note text,
  add column if not exists additional_information_reason text,
  add column if not exists payment_recorded_at timestamptz,
  add column if not exists payment_recorded_by uuid references public.profiles(id) on delete set null;

update public.payouts
set source_currency=coalesce(source_currency,currency),
    destination_currency=coalesce(destination_currency,currency),
    gross_amount_minor=coalesce(gross_amount_minor,amount_minor),
    net_amount_minor=coalesce(net_amount_minor,amount_minor),
    requested_at=coalesce(requested_at,created_at),
    provider_transaction_id=coalesce(provider_transaction_id,provider_payout_id)
where source_currency is null
   or destination_currency is null
   or gross_amount_minor is null
   or net_amount_minor is null
   or requested_at is null
   or (provider_transaction_id is null and provider_payout_id is not null);

update public.payouts
set payout_reference =
  'NXP-' || to_char(coalesce(created_at,now()),'YYYY') || '-' ||
  lpad(nextval('public.nexo_payout_reference_seq')::text, 8, '0')
where payout_reference is null;

create unique index if not exists payouts_reference_uidx
  on public.payouts(payout_reference);
create unique index if not exists payouts_provider_transaction_uidx
  on public.payouts(provider_id, provider_transaction_id)
  where provider_id is not null and provider_transaction_id is not null;
create index if not exists payouts_country_currency_status_idx
  on public.payouts(country_code, destination_currency, status, created_at desc);

create or replace function public.assign_nexo_payout_reference()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.payout_reference is null or btrim(new.payout_reference)='' then
    new.payout_reference :=
      'NXP-' || to_char(coalesce(new.created_at,now()),'YYYY') || '-' ||
      lpad(nextval('public.nexo_payout_reference_seq')::text,8,'0');
  end if;
  return new;
end;
$$;

drop trigger if exists payouts_assign_reference on public.payouts;
create trigger payouts_assign_reference
before insert on public.payouts
for each row execute function public.assign_nexo_payout_reference();

create table if not exists public.payout_events (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  status public.payout_status,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  description text not null,
  internal_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payout_events_timeline_idx
  on public.payout_events(payout_id, created_at, id);

create table if not exists public.payout_payment_records (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete restrict,
  attempt_no integer not null default 1 check (attempt_no > 0),
  provider_id uuid references public.payout_providers(id) on delete set null,
  provider_reference text not null,
  amount_sent_minor bigint not null check (amount_sent_minor > 0),
  currency_sent char(3) not null,
  recipient_amount_minor bigint not null check (recipient_amount_minor >= 0),
  recipient_currency char(3) not null,
  provider_fee_minor bigint not null default 0 check (provider_fee_minor >= 0),
  nexo_fee_minor bigint not null default 0 check (nexo_fee_minor >= 0),
  fx_fee_minor bigint not null default 0 check (fx_fee_minor >= 0),
  fx_rate_numerator bigint,
  fx_rate_denominator bigint,
  sent_at timestamptz not null,
  admin_note text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (payout_id, attempt_no)
);

create unique index if not exists payout_payment_provider_ref_uidx
  on public.payout_payment_records(provider_id, provider_reference)
  where provider_id is not null;

create table if not exists public.payout_receipts (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  payment_record_id uuid references public.payout_payment_records(id) on delete cascade,
  object_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint,
  exposed_to_recipient boolean not null default false,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Existing tax table is extended instead of creating a competing tax profile.
alter table public.account_tax_details
  add column if not exists tax_residency text,
  add column if not exists beneficiary_classification text,
  add column if not exists required_tax_form text,
  add column if not exists tax_form_status text not null default 'not_required',
  add column if not exists submission_date date,
  add column if not exists expiration_date date,
  add column if not exists tax_id_encrypted text,
  add column if not exists tax_id_mask text,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.account_tax_details'::regclass
      and conname='account_tax_details_status_check'
  ) then
    alter table public.account_tax_details
      add constraint account_tax_details_status_check
      check (tax_form_status in ('not_required','required','pending','complete','expired','rejected'));
  end if;
end $$;

create table if not exists public.payout_tax_rules (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) references public.payout_countries(iso2) on delete cascade,
  account_type text check (account_type in ('artist','label')),
  beneficiary_type text check (beneficiary_type in ('individual','business')),
  required boolean not null default false,
  blocks_payout boolean not null default false,
  required_form text,
  notes text,
  enabled boolean not null default true,
  priority integer not null default 100,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS and least-privilege reads
-- ---------------------------------------------------------------------------
alter table public.payout_providers enable row level security;
alter table public.payout_countries enable row level security;
alter table public.payout_currencies enable row level security;
alter table public.payout_method_catalog enable row level security;
alter table public.payout_provider_routes enable row level security;
alter table public.payout_method_fields enable row level security;
alter table public.payout_mobile_networks enable row level security;
alter table public.payout_fee_rules enable row level security;
alter table public.payout_limit_rules enable row level security;
alter table public.payout_security_settings enable row level security;
alter table public.payout_fx_rates enable row level security;
alter table public.payout_events enable row level security;
alter table public.payout_payment_records enable row level security;
alter table public.payout_receipts enable row level security;
alter table public.payout_tax_rules enable row level security;

drop policy if exists payout_providers_read on public.payout_providers;
create policy payout_providers_read on public.payout_providers
for select to authenticated
using (enabled or public.is_admin_portal_staff(auth.uid()));

drop policy if exists payout_countries_read on public.payout_countries;
create policy payout_countries_read on public.payout_countries
for select to authenticated
using (enabled or public.is_admin_portal_staff(auth.uid()));

drop policy if exists payout_currencies_read on public.payout_currencies;
create policy payout_currencies_read on public.payout_currencies
for select to authenticated
using (enabled or public.is_admin_portal_staff(auth.uid()));

drop policy if exists payout_method_catalog_read on public.payout_method_catalog;
create policy payout_method_catalog_read on public.payout_method_catalog
for select to authenticated
using ((enabled and not maintenance_mode) or public.is_admin_portal_staff(auth.uid()));

drop policy if exists payout_routes_read on public.payout_provider_routes;
create policy payout_routes_read on public.payout_provider_routes
for select to authenticated
using (
  public.is_admin_portal_staff(auth.uid())
  or (
    enabled
    and exists (select 1 from public.payout_providers p where p.id=provider_id and p.enabled and not p.maintenance_mode)
  )
);

drop policy if exists payout_fields_read on public.payout_method_fields;
create policy payout_fields_read on public.payout_method_fields
for select to authenticated
using (enabled or public.is_admin_portal_staff(auth.uid()));

drop policy if exists payout_mobile_networks_read on public.payout_mobile_networks;
create policy payout_mobile_networks_read on public.payout_mobile_networks
for select to authenticated
using (enabled or public.is_admin_portal_staff(auth.uid()));

drop policy if exists payout_fee_rules_staff_read on public.payout_fee_rules;
create policy payout_fee_rules_staff_read on public.payout_fee_rules
for select to authenticated
using (public.is_admin_portal_staff(auth.uid()));

drop policy if exists payout_limit_rules_staff_read on public.payout_limit_rules;
create policy payout_limit_rules_staff_read on public.payout_limit_rules
for select to authenticated
using (public.is_admin_portal_staff(auth.uid()));

drop policy if exists payout_security_staff_read on public.payout_security_settings;
create policy payout_security_staff_read on public.payout_security_settings
for select to authenticated
using (public.is_admin_portal_staff(auth.uid()));

drop policy if exists payout_fx_staff_read on public.payout_fx_rates;
create policy payout_fx_staff_read on public.payout_fx_rates
for select to authenticated
using (public.is_admin_portal_staff(auth.uid()));

drop policy if exists payout_events_owner_staff_read on public.payout_events;
create policy payout_events_owner_staff_read on public.payout_events
for select to authenticated
using (owner_user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:payouts'));

drop policy if exists payout_payment_records_staff_read on public.payout_payment_records;
create policy payout_payment_records_staff_read on public.payout_payment_records
for select to authenticated
using (public.has_staff_permission(auth.uid(),'admin:payouts'));

drop policy if exists payout_receipts_staff_read on public.payout_receipts;
create policy payout_receipts_staff_read on public.payout_receipts
for select to authenticated
using (public.has_staff_permission(auth.uid(),'admin:payouts'));

drop policy if exists payout_tax_rules_read on public.payout_tax_rules;
create policy payout_tax_rules_read on public.payout_tax_rules
for select to authenticated
using (enabled or public.is_admin_portal_staff(auth.uid()));

revoke insert, update, delete on
  public.payout_providers,
  public.payout_countries,
  public.payout_currencies,
  public.payout_method_catalog,
  public.payout_provider_routes,
  public.payout_method_fields,
  public.payout_mobile_networks,
  public.payout_fee_rules,
  public.payout_limit_rules,
  public.payout_security_settings,
  public.payout_fx_rates,
  public.payout_events,
  public.payout_payment_records,
  public.payout_receipts,
  public.payout_tax_rules
from authenticated, anon;

grant select on
  public.payout_providers,
  public.payout_countries,
  public.payout_currencies,
  public.payout_method_catalog,
  public.payout_provider_routes,
  public.payout_method_fields,
  public.payout_mobile_networks,
  public.payout_fee_rules,
  public.payout_limit_rules,
  public.payout_security_settings,
  public.payout_fx_rates,
  public.payout_events,
  public.payout_payment_records,
  public.payout_receipts,
  public.payout_tax_rules
to authenticated;

grant all on
  public.payout_providers,
  public.payout_countries,
  public.payout_currencies,
  public.payout_method_catalog,
  public.payout_provider_routes,
  public.payout_method_fields,
  public.payout_mobile_networks,
  public.payout_fee_rules,
  public.payout_limit_rules,
  public.payout_security_settings,
  public.payout_fx_rates,
  public.payout_events,
  public.payout_payment_records,
  public.payout_receipts,
  public.payout_tax_rules
to service_role;

-- Payout account ciphertext and legacy plaintext details are never client-readable.
revoke select on public.payout_methods from authenticated;
grant select (
  id,user_id,method_type,display_name,country_code,currency,beneficiary_name,
  provider,is_preferred,status,admin_note,created_at,updated_at,
  route_method_id,beneficiary_type,destination_mask,institution_name,public_details,
  last_sensitive_change_at,security_hold_until,verified_at,verification_reference
) on public.payout_methods to authenticated;

-- Tax identifiers are server-only; owners read only safe tax profile columns.
revoke select on public.account_tax_details from authenticated;
grant select (
  owner_user_id,legal_name,country,updated_at,tax_residency,
  beneficiary_classification,required_tax_form,tax_form_status,
  submission_date,expiration_date,tax_id_mask
) on public.account_tax_details to authenticated;

-- ---------------------------------------------------------------------------
-- Seed configurable defaults. These are ordinary rows and can be changed by Admin.
-- No provider API capability or FX rate is fabricated.
-- ---------------------------------------------------------------------------
insert into public.payout_providers
(code,name,enabled,manual_payout_enabled,api_enabled,bulk_payout_supported,priority,notes)
values
('grey_business','Grey Business',true,true,false,false,10,'Manual payout workflow. API remains disabled until verified credentials and adapter are configured.'),
('manual_bank_transfer','Manual Bank Transfer',true,true,false,false,90,'Manual finance fallback.'),
('monnify','Monnify',false,false,false,false,30,'Future provider; disabled until configured.'),
('paystack','Paystack',false,false,false,false,40,'Future provider; disabled until configured.'),
('flutterwave','Flutterwave',false,false,false,false,50,'Future provider; disabled until configured.'),
('payoneer','Payoneer',false,false,false,false,60,'Future provider; disabled until configured.')
on conflict (code) do nothing;

insert into public.payout_countries
(iso2,iso3,name,flag,calling_code,enabled,sort_order)
values
('NG','NGA','Nigeria','🇳🇬','+234',true,10),
('US','USA','United States','🇺🇸','+1',true,20),
('GB','GBR','United Kingdom','🇬🇧','+44',true,30),
('DE','DEU','Germany','🇩🇪','+49',true,40),
('FR','FRA','France','🇫🇷','+33',true,50),
('KE','KEN','Kenya','🇰🇪','+254',true,60),
('GH','GHA','Ghana','🇬🇭','+233',true,70),
('ZA','ZAF','South Africa','🇿🇦','+27',true,80),
('IN','IND','India','🇮🇳','+91',true,90)
on conflict (iso2) do nothing;

insert into public.payout_currencies
(code,name,symbol,decimal_precision,enabled,fx_enabled,processing_time_text)
values
('NGN','Nigerian Naira','₦',2,true,true,'Processing time depends on the selected payout route.'),
('USD','US Dollar','$',2,true,true,'Processing time depends on the selected payout route.'),
('GBP','Pound Sterling','£',2,true,true,'Processing time depends on the selected payout route.'),
('EUR','Euro','€',2,true,true,'Processing time depends on the selected payout route.'),
('KES','Kenyan Shilling','KSh',2,true,true,'Processing time depends on the selected payout route.'),
('GHS','Ghanaian Cedi','GH₵',2,true,true,'Processing time depends on the selected payout route.'),
('ZAR','South African Rand','R',2,true,true,'Processing time depends on the selected payout route.'),
('INR','Indian Rupee','₹',2,true,true,'Processing time depends on the selected payout route.')
on conflict (code) do nothing;

insert into public.payout_method_catalog(code,name,icon,enabled,processing_time_text,display_order)
values
('bank_transfer','Bank Transfer','bank',true,'Bank processing times vary by destination.',10),
('ach','ACH','landmark',true,'ACH processing times vary by receiving bank.',20),
('wire','Wire','send',true,'Wire processing times vary by receiving bank.',30),
('sepa','SEPA','landmark',true,'SEPA processing times vary by receiving bank.',40),
('greytag','GreyTag','at-sign',true,'GreyTag processing is completed manually by Nexo Finance while API mode is disabled.',50),
('mobile_money','Mobile Money','smartphone',true,'Mobile Money processing times vary by network.',60),
('manual_bank_transfer','Manual Bank Transfer','banknote',true,'Processed manually by Nexo Finance.',90)
on conflict (code) do nothing;

insert into public.payout_mobile_networks(country_code,code,name,enabled,display_order)
values
('KE','safaricom','Safaricom',true,10),
('KE','airtel','Airtel',true,20)
on conflict (country_code,code) do nothing;

-- Route helper: Grey primary + manual-bank backup for bank-like routes.
with routes(country_code,currency_code,method_code,enabled) as (
  values
    ('NG'::char(2),'NGN'::char(3),'bank_transfer',true),
    ('US'::char(2),'USD'::char(3),'ach',true),
    ('US'::char(2),'USD'::char(3),'wire',true),
    ('GB'::char(2),'GBP'::char(3),'bank_transfer',true),
    ('DE'::char(2),'EUR'::char(3),'sepa',true),
    ('FR'::char(2),'EUR'::char(3),'sepa',true),
    ('KE'::char(2),'KES'::char(3),'bank_transfer',true),
    ('KE'::char(2),'KES'::char(3),'mobile_money',true),
    ('GH'::char(2),'GHS'::char(3),'bank_transfer',true),
    ('GH'::char(2),'GHS'::char(3),'mobile_money',false),
    ('ZA'::char(2),'ZAR'::char(3),'bank_transfer',true),
    ('IN'::char(2),'INR'::char(3),'bank_transfer',true)
), beneficiaries(beneficiary_type) as (
  values ('individual'::text),('business'::text)
)
insert into public.payout_provider_routes
(country_code,currency_code,method_id,beneficiary_type,provider_id,priority,is_backup,enabled)
select r.country_code,r.currency_code,m.id,b.beneficiary_type,p.id,10,false,r.enabled
from routes r
join public.payout_method_catalog m on m.code=r.method_code
cross join beneficiaries b
join public.payout_providers p on p.code='grey_business'
on conflict (country_code,currency_code,method_id,beneficiary_type,provider_id) do nothing;

with routes(country_code,currency_code,method_code,enabled) as (
  values
    ('NG'::char(2),'NGN'::char(3),'bank_transfer',true),
    ('US'::char(2),'USD'::char(3),'ach',true),
    ('US'::char(2),'USD'::char(3),'wire',true),
    ('GB'::char(2),'GBP'::char(3),'bank_transfer',true),
    ('DE'::char(2),'EUR'::char(3),'sepa',true),
    ('FR'::char(2),'EUR'::char(3),'sepa',true),
    ('KE'::char(2),'KES'::char(3),'bank_transfer',true),
    ('GH'::char(2),'GHS'::char(3),'bank_transfer',true),
    ('ZA'::char(2),'ZAR'::char(3),'bank_transfer',true),
    ('IN'::char(2),'INR'::char(3),'bank_transfer',true)
), beneficiaries(beneficiary_type) as (
  values ('individual'::text),('business'::text)
)
insert into public.payout_provider_routes
(country_code,currency_code,method_id,beneficiary_type,provider_id,priority,is_backup,enabled)
select r.country_code,r.currency_code,m.id,b.beneficiary_type,p.id,90,true,r.enabled
from routes r
join public.payout_method_catalog m on m.code=r.method_code
cross join beneficiaries b
join public.payout_providers p on p.code='manual_bank_transfer'
on conflict (country_code,currency_code,method_id,beneficiary_type,provider_id) do nothing;

-- GreyTag is independently routable/configurable.
with greytag_routes(country_code,currency_code) as (
  values
    ('NG'::char(2),'NGN'::char(3)),
    ('US'::char(2),'USD'::char(3)),
    ('GB'::char(2),'GBP'::char(3)),
    ('DE'::char(2),'EUR'::char(3)),
    ('FR'::char(2),'EUR'::char(3))
), beneficiaries(beneficiary_type) as (
  values ('individual'::text),('business'::text)
)
insert into public.payout_provider_routes
(country_code,currency_code,method_id,beneficiary_type,provider_id,priority,is_backup,enabled)
select r.country_code,r.currency_code,m.id,b.beneficiary_type,p.id,10,false,true
from greytag_routes r
join public.payout_method_catalog m on m.code='greytag'
cross join beneficiaries b
join public.payout_providers p on p.code='grey_business'
on conflict (country_code,currency_code,method_id,beneficiary_type,provider_id) do nothing;

-- Dynamic fields: Nigeria bank transfer.
with b(beneficiary_type) as (values ('individual'::text),('business'::text)),
m as (select id from public.payout_method_catalog where code='bank_transfer')
insert into public.payout_method_fields
(country_code,currency_code,method_id,beneficiary_type,field_key,display_label,input_type,required,minimum_length,maximum_length,validation_regex,numeric_only,display_order,encrypted,masked)
select 'NG','NGN',m.id,b.beneficiary_type,v.field_key,v.label,v.input_type,v.required,v.min_len,v.max_len,v.regex,v.numeric_only,v.ord,v.encrypted,v.masked
from b cross join m cross join (values
  ('beneficiary_name','Account holder legal name','text',true,2,160,null,false,10,false,false),
  ('bank_name','Bank name','bank_selector',true,2,160,null,false,20,false,false),
  ('bank_code','Bank code','text',false,2,30,'^[A-Za-z0-9_-]+$',false,30,true,true),
  ('account_number','Account number','number',true,10,10,'^[0-9]{10}$',true,40,true,true)
) as v(field_key,label,input_type,required,min_len,max_len,regex,numeric_only,ord,encrypted,masked)
on conflict (country_code,currency_code,method_id,beneficiary_type,field_key) do nothing;

-- United States ACH / Wire.
with methods as (
  select id,code from public.payout_method_catalog where code in ('ach','wire')
), beneficiaries(beneficiary_type) as (values ('individual'::text),('business'::text))
insert into public.payout_method_fields
(country_code,currency_code,method_id,beneficiary_type,field_key,display_label,input_type,required,minimum_length,maximum_length,validation_regex,numeric_only,display_order,encrypted,masked,options)
select 'US','USD',m.id,b.beneficiary_type,v.field_key,v.label,v.input_type,v.required,v.min_len,v.max_len,v.regex,v.numeric_only,v.ord,v.encrypted,v.masked,v.options::jsonb
from methods m
cross join beneficiaries b
cross join lateral (values
  (case when b.beneficiary_type='business' then 'business_name' else 'first_name' end,
   case when b.beneficiary_type='business' then 'Legal business name' else 'First name' end,
   'text',true,2,200,null,false,10,false,false,'[]'),
  (case when b.beneficiary_type='business' then 'authorized_representative' else 'last_name' end,
   case when b.beneficiary_type='business' then 'Authorized representative' else 'Last name' end,
   'text',true,2,200,null,false,20,false,false,'[]'),
  ('bank_name','Bank name','text',true,2,160,null,false,30,false,false,'[]'),
  ('account_number','Account number','text',true,4,34,'^[0-9A-Za-z]+$',false,40,true,true,'[]'),
  ('account_type','Account type','select',true,0,0,null,false,50,false,false,
   case when b.beneficiary_type='business'
     then '[{"value":"business_checking","label":"Business checking"},{"value":"checking","label":"Checking"},{"value":"savings","label":"Savings"}]'
     else '[{"value":"checking","label":"Checking"},{"value":"savings","label":"Savings"}]' end),
  ('routing_number','Routing number','number',true,9,9,'^[0-9]{9}$',true,60,true,true,'[]'),
  ('address_line_1','Street address','text',true,2,200,null,false,70,false,false,'[]'),
  ('city','City','text',true,2,120,null,false,80,false,false,'[]'),
  ('state','State','text',true,2,80,null,false,90,false,false,'[]'),
  ('postal_code','ZIP code','text',true,5,10,'^[0-9]{5}(?:-[0-9]{4})?$',false,100,false,false,'[]'),
  ('country','Country','country',true,2,2,'^US$',false,110,false,false,'[]'),
  ('payment_scheme','Payment scheme','select',true,0,0,null,false,120,false,false,
   case when m.code='ach'
     then '[{"value":"ach","label":"ACH"}]'
     else '[{"value":"wire","label":"Wire"}]' end)
) as v(field_key,label,input_type,required,min_len,max_len,regex,numeric_only,ord,encrypted,masked,options)
on conflict (country_code,currency_code,method_id,beneficiary_type,field_key) do nothing;

-- United Kingdom GBP bank transfer.
with b(beneficiary_type) as (values ('individual'::text),('business'::text)),
m as (select id from public.payout_method_catalog where code='bank_transfer')
insert into public.payout_method_fields
(country_code,currency_code,method_id,beneficiary_type,field_key,display_label,input_type,required,minimum_length,maximum_length,validation_regex,numeric_only,display_order,encrypted,masked)
select 'GB','GBP',m.id,b.beneficiary_type,v.field_key,v.label,v.input_type,v.required,v.min_len,v.max_len,v.regex,v.numeric_only,v.ord,v.encrypted,v.masked
from b cross join m
cross join lateral (values
  (case when b.beneficiary_type='business' then 'business_name' else 'first_name' end,
   case when b.beneficiary_type='business' then 'Legal business name' else 'First name' end,
   'text',true,2,200,null,false,10,false,false),
  (case when b.beneficiary_type='business' then 'authorized_representative' else 'last_name' end,
   case when b.beneficiary_type='business' then 'Authorized representative' else 'Last name' end,
   'text',true,2,200,null,false,20,false,false),
  ('bank_name','Bank name','text',true,2,160,null,false,30,false,false),
  ('account_number','Account number','number',true,8,8,'^[0-9]{8}$',true,40,true,true),
  ('sort_code','Sort code','text',true,6,8,'^(?:[0-9]{6}|[0-9]{2}-[0-9]{2}-[0-9]{2})$',false,50,true,true),
  ('swift_bic','SWIFT / BIC','text',false,8,11,'^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$',false,60,true,true),
  ('payment_reference','Payment description','text',false,1,140,null,false,70,false,false)
) as v(field_key,label,input_type,required,min_len,max_len,regex,numeric_only,ord,encrypted,masked)
on conflict (country_code,currency_code,method_id,beneficiary_type,field_key) do nothing;

-- EUR / SEPA with country-specific IBAN lengths.
with b(beneficiary_type) as (values ('individual'::text),('business'::text)),
m as (select id from public.payout_method_catalog where code='sepa'),
countries(country_code,iban_len) as (values ('DE'::char(2),22),('FR'::char(2),27))
insert into public.payout_method_fields
(country_code,currency_code,method_id,beneficiary_type,field_key,display_label,input_type,required,minimum_length,maximum_length,validation_regex,numeric_only,display_order,encrypted,masked)
select c.country_code,'EUR',m.id,b.beneficiary_type,v.field_key,v.label,v.input_type,v.required,
       case when v.field_key='iban' then c.iban_len else v.min_len end,
       case when v.field_key='iban' then c.iban_len else v.max_len end,
       v.regex,v.numeric_only,v.ord,v.encrypted,v.masked
from countries c cross join b cross join m
cross join lateral (values
  ('recipient_country','Recipient country','country',true,2,2,'^[A-Z]{2}$',false,10,false,false),
  (case when b.beneficiary_type='business' then 'business_name' else 'first_name' end,
   case when b.beneficiary_type='business' then 'Business name' else 'First name' end,
   'text',true,2,200,null,false,20,false,false),
  (case when b.beneficiary_type='business' then 'authorized_representative' else 'last_name' end,
   case when b.beneficiary_type='business' then 'Authorized representative' else 'Last name' end,
   'text',true,2,200,null,false,30,false,false),
  ('iban','IBAN','text',true,15,34,'^[A-Z]{2}[0-9]{2}[A-Z0-9]+$',false,40,true,true),
  ('swift_bic','BIC / SWIFT','text',false,8,11,'^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$',false,50,true,true),
  ('payment_reference','Payment description','text',false,1,140,null,false,60,false,false)
) as v(field_key,label,input_type,required,min_len,max_len,regex,numeric_only,ord,encrypted,masked)
on conflict (country_code,currency_code,method_id,beneficiary_type,field_key) do nothing;

-- GreyTag dynamic fields for each configured GreyTag route.
insert into public.payout_method_fields
(country_code,currency_code,method_id,beneficiary_type,field_key,display_label,input_type,required,minimum_length,maximum_length,validation_regex,numeric_only,display_order,encrypted,masked)
select distinct r.country_code,r.currency_code,r.method_id,r.beneficiary_type,
  v.field_key,v.label,v.input_type,v.required,v.min_len,v.max_len,v.regex,false,v.ord,v.encrypted,v.masked
from public.payout_provider_routes r
join public.payout_method_catalog m on m.id=r.method_id and m.code='greytag'
cross join (values
  ('greytag','GreyTag','text',true,2,100,'^@[A-Za-z0-9._-]+$',10,true,true),
  ('account_holder_name','Account holder name','text',true,2,200,null,20,false,false),
  ('preferred_receiving_currency','Preferred receiving currency','currency',true,3,3,'^[A-Z]{3}$',30,false,false),
  ('confirm_ownership','I confirm that this GreyTag belongs to me or my registered business.','checkbox',true,null,null,null,40,false,false)
) as v(field_key,label,input_type,required,min_len,max_len,regex,ord,encrypted,masked)
on conflict (country_code,currency_code,method_id,beneficiary_type,field_key) do nothing;

-- Kenya / Ghana Mobile Money.
with m as (select id from public.payout_method_catalog where code='mobile_money'),
routes(country_code,currency_code) as (
  values ('KE'::char(2),'KES'::char(3)),('GH'::char(2),'GHS'::char(3))
), b(beneficiary_type) as (values ('individual'::text),('business'::text))
insert into public.payout_method_fields
(country_code,currency_code,method_id,beneficiary_type,field_key,display_label,input_type,required,minimum_length,maximum_length,validation_regex,numeric_only,display_order,encrypted,masked)
select r.country_code,r.currency_code,m.id,b.beneficiary_type,
       v.field_key,v.label,v.input_type,v.required,v.min_len,v.max_len,v.regex,v.numeric_only,v.ord,v.encrypted,v.masked
from routes r cross join b cross join m
cross join (values
  ('beneficiary_name','Recipient legal name','text',true,2,200,null,false,10,false,false),
  ('mobile_money_number','Mobile number','phone',true,7,20,'^[+0-9 ]{7,20}$',false,20,true,true),
  ('country_calling_code','Country calling code','text',true,2,6,'^\\+[0-9]{1,4}$',false,30,false,false),
  ('mobile_money_network','Mobile network','mobile_network_selector',true,2,80,null,false,40,false,false)
) as v(field_key,label,input_type,required,min_len,max_len,regex,numeric_only,ord,encrypted,masked)
on conflict (country_code,currency_code,method_id,beneficiary_type,field_key) do nothing;

-- India bank transfer.
with b(beneficiary_type) as (values ('individual'::text),('business'::text)),
m as (select id from public.payout_method_catalog where code='bank_transfer')
insert into public.payout_method_fields
(country_code,currency_code,method_id,beneficiary_type,field_key,display_label,input_type,required,minimum_length,maximum_length,validation_regex,numeric_only,display_order,encrypted,masked)
select 'IN','INR',m.id,b.beneficiary_type,v.field_key,v.label,v.input_type,v.required,v.min_len,v.max_len,v.regex,v.numeric_only,v.ord,v.encrypted,v.masked
from b cross join m
cross join lateral (values
  (case when b.beneficiary_type='business' then 'business_name' else 'beneficiary_name' end,
   case when b.beneficiary_type='business' then 'Legal business name' else 'Recipient legal name' end,
   'text',true,2,200,null,false,10,false,false),
  ('bank_name','Bank name','text',true,2,160,null,false,20,false,false),
  ('account_number','Account number','text',true,6,34,'^[0-9]+$',true,30,true,true),
  ('ifsc','IFSC code','text',true,11,11,'^[A-Z]{4}0[A-Z0-9]{6}$',false,40,true,true),
  ('address_line_1','Address','text',false,2,200,null,false,50,false,false)
) as v(field_key,label,input_type,required,min_len,max_len,regex,numeric_only,ord,encrypted,masked)
on conflict (country_code,currency_code,method_id,beneficiary_type,field_key) do nothing;

-- Generic bank fields for Kenya, Ghana and South Africa; still route-specific/configurable.
with routes(country_code,currency_code) as (
  values ('KE'::char(2),'KES'::char(3)),('GH'::char(2),'GHS'::char(3)),('ZA'::char(2),'ZAR'::char(3))
), b(beneficiary_type) as (values ('individual'::text),('business'::text)),
m as (select id from public.payout_method_catalog where code='bank_transfer')
insert into public.payout_method_fields
(country_code,currency_code,method_id,beneficiary_type,field_key,display_label,input_type,required,minimum_length,maximum_length,validation_regex,numeric_only,display_order,encrypted,masked)
select r.country_code,r.currency_code,m.id,b.beneficiary_type,v.field_key,v.label,v.input_type,v.required,v.min_len,v.max_len,v.regex,v.numeric_only,v.ord,v.encrypted,v.masked
from routes r cross join b cross join m
cross join (values
  ('beneficiary_name','Account holder legal name','text',true,2,200,null,false,10,false,false),
  ('bank_name','Bank name','text',true,2,160,null,false,20,false,false),
  ('account_number','Account number','text',true,4,34,'^[0-9A-Za-z]+$',false,30,true,true),
  ('branch_code','Branch code','text',false,2,30,'^[0-9A-Za-z-]+$',false,40,true,true),
  ('swift_bic','SWIFT / BIC','text',false,8,11,'^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$',false,50,true,true)
) as v(field_key,label,input_type,required,min_len,max_len,regex,numeric_only,ord,encrypted,masked)
on conflict (country_code,currency_code,method_id,beneficiary_type,field_key) do nothing;

-- Preserve the existing USD minimum as a configurable rule.
do $$
declare
  v_min bigint := 5000;
  raw text;
begin
  select value #>> '{}' into raw
  from public.admin_settings
  where key='finance.min_payout_minor_usd';
  if raw ~ '^[0-9]+$' then
    v_min := raw::bigint;
  end if;

  if not exists (
    select 1 from public.payout_limit_rules
    where name='Legacy USD minimum'
  ) then
    insert into public.payout_limit_rules(name,currency_code,minimum_payout_minor,priority)
    values ('Legacy USD minimum','USD',v_min,900);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Plan segment / messaging helpers
-- ---------------------------------------------------------------------------
create or replace function public.resolve_payout_plan_segment(p_owner uuid)
returns text
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  account_kind text;
  paid boolean := false;
begin
  select account_type into account_kind from public.profiles where id=p_owner;
  if account_kind='artist' then
    paid :=
      exists (
        select 1 from public.billing_entitlement_overrides o
        where o.user_id=p_owner
          and o.status in ('active','trialing')
          and (o.ends_at is null or o.ends_at>now())
          and o.plan_id='artist_pro'
      )
      or exists (
        select 1 from public.billing_subscriptions s
        where s.user_id=p_owner
          and s.status in ('active','trialing')
          and s.plan_id='artist_pro'
      );
  elsif account_kind='label' then
    paid :=
      exists (
        select 1 from public.billing_entitlement_overrides o
        where o.user_id=p_owner
          and o.status in ('active','trialing')
          and (o.ends_at is null or o.ends_at>now())
          and o.plan_id in ('label_starter','label_pro')
      )
      or exists (
        select 1 from public.billing_subscriptions s
        where s.user_id=p_owner
          and s.status in ('active','trialing')
          and s.plan_id in ('label_starter','label_pro')
      );
  end if;
  return case when paid then 'paid' else 'free' end;
end;
$$;

revoke all on function public.resolve_payout_plan_segment(uuid) from public,anon;
grant execute on function public.resolve_payout_plan_segment(uuid) to authenticated,service_role;

create or replace function public.queue_payout_user_message(
  p_payout public.payouts,
  p_event text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  title text;
  body text;
  template text := 'payout_status_update';
begin
  title := case p_event
    when 'requested' then 'Payout request received'
    when 'approved' then 'Payout approved'
    when 'additional_information_requested' then 'Payout information required'
    when 'processing' then 'Payout processing'
    when 'paid' then 'Payout completed'
    when 'failed' then 'Payout could not be completed'
    when 'rejected' then 'Payout request rejected'
    when 'returned' then 'Payout returned'
    when 'cancelled' then 'Payout cancelled'
    else 'Payout update'
  end;

  body := case p_event
    when 'requested' then 'Your payout request has been received and is awaiting review.'
    when 'approved' then 'Your payout has been approved and is awaiting processing.'
    when 'additional_information_requested' then coalesce(p_reason,'Additional information is required before this payout can continue.')
    when 'processing' then 'Your payout is being processed.'
    when 'paid' then 'Your payout has been completed.'
    when 'failed' then 'We could not complete this payout. Review the details or contact Nexo Support.'
    when 'rejected' then coalesce(p_reason,'Your payout request was not approved.')
    when 'returned' then coalesce(p_reason,'This payout was returned after processing.')
    when 'cancelled' then 'This payout request has been cancelled.'
    else 'Your payout status has changed.'
  end;

  template := case p_event
    when 'requested' then 'payout_requested'
    when 'paid' then 'payout_paid'
    when 'failed' then 'payout_failed'
    when 'rejected' then 'payout_rejected'
    else 'payout_status_update'
  end;

  insert into public.notifications(user_id,type,title,body,entity_type,entity_id,metadata)
  values (
    p_payout.owner_user_id,
    'payout_update'::public.notification_type,
    title,
    body,
    'payout',
    p_payout.id,
    jsonb_build_object(
      'payout_reference',p_payout.payout_reference,
      'status',p_payout.status::text,
      'href','/earnings/payout-history/'||p_payout.id::text
    )
  );

  insert into public.email_outbound_events
  (to_email,template_key,payload,status,related_entity_type,related_entity_id)
  select
    pr.email,
    template,
    jsonb_strip_nulls(jsonb_build_object(
      'event',p_event,
      'payout_id',p_payout.id,
      'payout_reference',p_payout.payout_reference,
      'amount_minor',p_payout.gross_amount_minor,
      'currency',p_payout.source_currency,
      'destination_currency',p_payout.destination_currency,
      'net_amount_minor',p_payout.net_amount_minor,
      'status',p_payout.status::text,
      'destination_mask',p_payout.destination_mask,
      'provider',p_payout.provider_name,
      'reason',p_reason
    )),
    'pending',
    'payout',
    p_payout.id
  from public.profiles pr
  where pr.id=p_payout.owner_user_id
    and pr.email is not null;
end;
$$;

revoke all on function public.queue_payout_user_message(public.payouts,text,text) from public,anon,authenticated;
grant execute on function public.queue_payout_user_message(public.payouts,text,text) to service_role;

-- ---------------------------------------------------------------------------
-- Balance view: UNDER_REVIEW is also reserved. Paid remains reserved while its
-- ledger debit lives in the paid bucket; failed/rejected/cancelled/returned release it.
-- ---------------------------------------------------------------------------
create or replace view public.ledger_balances
with (security_invoker=true)
as
with ledger as (
  select
    owner_user_id,
    currency,
    coalesce(sum(amount_minor) filter (where balance_bucket='available'),0)::bigint as raw_available_minor,
    coalesce(sum(amount_minor) filter (where balance_bucket='pending'),0)::bigint as pending_minor,
    coalesce(sum(amount_minor) filter (where balance_bucket='paid'),0)::bigint as paid_minor,
    coalesce(sum(amount_minor) filter (where balance_bucket='held'),0)::bigint as held_minor,
    coalesce(sum(amount_minor),0)::bigint as total_minor
  from public.ledger_entries
  group by owner_user_id,currency
), reserved as (
  select
    owner_user_id,
    currency,
    coalesce(sum(amount_minor) filter (
      where status in ('pending','under_review','approved','processing','on_hold','paid')
    ),0)::bigint as reserved_minor
  from public.payouts
  group by owner_user_id,currency
)
select
  l.owner_user_id,
  l.currency,
  greatest(l.raw_available_minor-coalesce(r.reserved_minor,0),0)::bigint as available_minor,
  l.pending_minor,
  l.paid_minor,
  l.held_minor,
  l.total_minor,
  coalesce(r.reserved_minor,0)::bigint as reserved_payout_minor
from ledger l
left join reserved r
  on r.owner_user_id=l.owner_user_id
 and r.currency=l.currency;

comment on view public.ledger_balances is
  'Derived append-only ledger balances. available_minor excludes every live payout reservation including UNDER_REVIEW.';

-- ---------------------------------------------------------------------------
-- Protect immutable payout reference and trusted final financial transitions.
-- ---------------------------------------------------------------------------
create or replace function public.protect_payout_row()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  trusted text := coalesce(current_setting('nexo.trusted_financial_transition',true),'0');
begin
  if tg_op='DELETE' then
    raise exception 'Payouts cannot be deleted; use lifecycle transitions and compensating ledger entries' using errcode='42501';
  end if;

  if tg_op='UPDATE' then
    if new.payout_reference is distinct from old.payout_reference then
      raise exception 'Payout reference is immutable' using errcode='42501';
    end if;

    if new.status='paid' then
      if new.payment_reference is null or btrim(new.payment_reference)=''
         or new.paid_at is null then
        raise exception 'PAID requires payment reference and paid timestamp' using errcode='P0001';
      end if;
      if old.status is distinct from 'paid' and trusted<>'1' then
        raise exception 'PAID requires trusted financial transition' using errcode='42501';
      end if;
    end if;

    if new.status='returned'
       and old.status is distinct from 'returned'
       and trusted<>'1' then
      raise exception 'RETURNED requires trusted compensating transition' using errcode='42501';
    end if;

    if old.status='paid' and new.status not in ('paid','returned') then
      raise exception 'Paid payout can only become RETURNED through a compensating operation' using errcode='42501';
    end if;

    if old.status='returned' and new.status<>'returned' then
      raise exception 'Returned payout history is immutable; create a new retry payout' using errcode='42501';
    end if;

    if old.status in ('paid','returned')
       and (
         new.amount_minor is distinct from old.amount_minor
         or new.currency is distinct from old.currency
         or new.gross_amount_minor is distinct from old.gross_amount_minor
         or new.source_currency is distinct from old.source_currency
         or new.destination_currency is distinct from old.destination_currency
         or new.payout_method_id is distinct from old.payout_method_id
       ) then
      raise exception 'Completed payout financial snapshot is immutable' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

-- Existing trigger already points to protect_payout_row; reconcile explicitly.
drop trigger if exists payouts_protect on public.payouts;
drop trigger if exists protect_payouts on public.payouts;
create trigger payouts_protect
before update or delete on public.payouts
for each row execute function public.protect_payout_row();

-- ---------------------------------------------------------------------------
-- Race-safe configured payout creation.
-- ---------------------------------------------------------------------------
create or replace function public.create_configured_payout_request(
  p_owner_user_id uuid,
  p_amount_minor bigint,
  p_source_currency text,
  p_payout_method_id uuid,
  p_idempotency_key text
)
returns public.payouts
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  profile_row public.profiles;
  method_row public.payout_methods;
  method_catalog public.payout_method_catalog;
  route_row public.payout_provider_routes;
  provider_row public.payout_providers;
  country_row public.payout_countries;
  source_currency_row public.payout_currencies;
  destination_currency_row public.payout_currencies;
  security_row public.payout_security_settings;
  limit_row public.payout_limit_rules;
  provider_fee_rule public.payout_fee_rules;
  nexo_fee_rule public.payout_fee_rules;
  fx_row public.payout_fx_rates;
  existing public.payouts;
  created public.payouts;
  plan_segment text;
  available_value bigint := 0;
  minimum_value bigint := 0;
  maximum_value bigint;
  provider_fee_value bigint := 0;
  nexo_fee_value bigint := 0;
  fx_fee_value bigint := 0;
  recipient_provider_fee bigint := 0;
  recipient_nexo_fee bigint := 0;
  recipient_fx_fee bigint := 0;
  net_source bigint;
  net_destination bigint;
  account_id uuid;
  daily_sum bigint := 0;
  weekly_sum bigint := 0;
  monthly_sum bigint := 0;
  daily_count integer := 0;
  weekly_count integer := 0;
  monthly_count integer := 0;
  require_identity boolean := false;
  require_tax boolean := false;
  global_enabled text;
begin
  if actor is null or actor<>p_owner_user_id then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_amount_minor is null or p_amount_minor<=0 then
    raise exception 'Payout amount must be positive' using errcode='P0001';
  end if;
  if p_source_currency is null or upper(btrim(p_source_currency)) !~ '^[A-Z]{3}$' then
    raise exception 'Valid source currency required' using errcode='P0001';
  end if;
  if p_idempotency_key is null or char_length(btrim(p_idempotency_key))<8 then
    raise exception 'Idempotency key required' using errcode='P0001';
  end if;

  select * into existing
  from public.payouts
  where owner_user_id=p_owner_user_id and idempotency_key=p_idempotency_key;
  if found then return existing; end if;

  perform pg_advisory_xact_lock(hashtext(p_owner_user_id::text||':'||upper(btrim(p_source_currency))));

  select * into profile_row from public.profiles where id=p_owner_user_id for share;
  if not found or profile_row.account_status<>'active' then
    raise exception 'Account is not eligible for payouts' using errcode='P0001';
  end if;
  if profile_row.account_type not in ('artist','label') then
    raise exception 'Payouts are available to Artist and Label accounts' using errcode='P0001';
  end if;
  if coalesce(profile_row.restriction_kind::text,'none') in ('login_restricted','read_only') then
    raise exception 'Account restriction blocks payouts' using errcode='P0001';
  end if;

  select coalesce(value #>> '{}','true') into global_enabled
  from public.admin_settings where key='finance.payouts_enabled';
  if global_enabled is not null and lower(global_enabled) in ('false','0','no') then
    raise exception 'Payout requests are temporarily unavailable' using errcode='P0001';
  end if;

  if exists (
    select 1 from public.payout_compliance_holds h
    where h.owner_user_id=p_owner_user_id and h.active=true
  ) then
    raise exception 'A payout hold is active on this account' using errcode='P0001';
  end if;

  select * into method_row
  from public.payout_methods
  where id=p_payout_method_id and user_id=p_owner_user_id
  for share;
  if not found or method_row.status<>'active' then
    raise exception 'Select an approved payout method' using errcode='P0001';
  end if;
  if method_row.route_method_id is null
     or method_row.country_code is null
     or method_row.currency is null
     or method_row.beneficiary_type is null then
    raise exception 'This payout method must be updated before it can be used' using errcode='P0001';
  end if;
  if method_row.security_hold_until is not null and method_row.security_hold_until>now() then
    raise exception 'This payout method is temporarily on a security hold after a recent change' using errcode='P0001';
  end if;

  select * into method_catalog
  from public.payout_method_catalog
  where id=method_row.route_method_id and enabled=true and maintenance_mode=false;
  if not found then
    raise exception 'This payout method is not currently available' using errcode='P0001';
  end if;

  select * into country_row
  from public.payout_countries
  where iso2=method_row.country_code and enabled=true;
  if not found then
    raise exception 'Payouts are not currently available for this country' using errcode='P0001';
  end if;
  if method_row.beneficiary_type='individual' and not country_row.individual_enabled then
    raise exception 'Individual beneficiaries are not enabled for this country' using errcode='P0001';
  end if;
  if method_row.beneficiary_type='business' and not country_row.business_enabled then
    raise exception 'Business beneficiaries are not enabled for this country' using errcode='P0001';
  end if;

  select * into source_currency_row
  from public.payout_currencies
  where code=upper(btrim(p_source_currency)) and enabled=true;
  if not found then
    raise exception 'Source currency is not enabled for payouts' using errcode='P0001';
  end if;

  select * into destination_currency_row
  from public.payout_currencies
  where code=method_row.currency and enabled=true;
  if not found then
    raise exception 'Destination currency is not enabled for payouts' using errcode='P0001';
  end if;

  select r.* into route_row
  from public.payout_provider_routes r
  join public.payout_providers pp on pp.id=r.provider_id
  where r.country_code=method_row.country_code
    and r.currency_code=method_row.currency
    and r.method_id=method_row.route_method_id
    and r.beneficiary_type=method_row.beneficiary_type
    and r.enabled=true
    and pp.enabled=true
    and pp.maintenance_mode=false
  order by r.is_backup asc,r.priority asc,pp.priority asc
  limit 1;
  if not found then
    raise exception 'No payout provider route is currently available for this method' using errcode='P0001';
  end if;

  select * into provider_row from public.payout_providers where id=route_row.provider_id;
  if provider_row.api_enabled=false and provider_row.manual_payout_enabled=false then
    raise exception 'Selected payout provider is not available for processing' using errcode='P0001';
  end if;

  select * into security_row from public.payout_security_settings where id='default';
  require_identity :=
    coalesce(security_row.require_identity_verification,false)
    or country_row.identity_verification_required
    or route_row.identity_verification_required;
  if require_identity and not exists (
    select 1 from public.identity_verifications iv
    where iv.user_id=p_owner_user_id and iv.status='verified'
  ) then
    raise exception 'Identity verification must be completed before requesting a payout' using errcode='P0001';
  end if;

  require_tax :=
    country_row.tax_information_required
    or route_row.tax_information_required
    or exists (
      select 1 from public.payout_tax_rules tr
      where tr.enabled=true
        and tr.required=true
        and tr.blocks_payout=true
        and (tr.country_code is null or tr.country_code=method_row.country_code)
        and (tr.account_type is null or tr.account_type=profile_row.account_type)
        and (tr.beneficiary_type is null or tr.beneficiary_type=method_row.beneficiary_type)
    );
  if require_tax and coalesce(security_row.tax_information_can_block,true) and not exists (
    select 1 from public.account_tax_details td
    where td.owner_user_id=p_owner_user_id and td.tax_form_status='complete'
  ) then
    raise exception 'Required tax information must be completed before requesting a payout' using errcode='P0001';
  end if;

  select coalesce(available_minor,0) into available_value
  from public.ledger_balances
  where owner_user_id=p_owner_user_id
    and currency=upper(btrim(p_source_currency));
  if coalesce(available_value,0)<p_amount_minor then
    raise exception 'Requested amount exceeds available royalty balance' using errcode='P0001';
  end if;

  plan_segment := public.resolve_payout_plan_segment(p_owner_user_id);

  select lr.* into limit_row
  from public.payout_limit_rules lr
  where lr.enabled=true
    and (lr.account_type is null or lr.account_type=profile_row.account_type)
    and (lr.plan_segment is null or lr.plan_segment=plan_segment)
    and (lr.country_code is null or lr.country_code=method_row.country_code)
    and (lr.currency_code is null or lr.currency_code=upper(btrim(p_source_currency)))
    and (lr.method_id is null or lr.method_id=method_row.route_method_id)
    and (lr.provider_id is null or lr.provider_id=route_row.provider_id)
  order by
    ((lr.account_type is not null)::int
     +(lr.plan_segment is not null)::int
     +(lr.country_code is not null)::int
     +(lr.currency_code is not null)::int
     +(lr.method_id is not null)::int
     +(lr.provider_id is not null)::int) desc,
    lr.priority asc
  limit 1;

  minimum_value := greatest(
    coalesce(source_currency_row.minimum_payout_minor,0),
    case
      when method_row.currency=upper(btrim(p_source_currency))
      then coalesce(country_row.minimum_payout_minor,0)
      else 0
    end,
    case
      when method_row.currency=upper(btrim(p_source_currency))
      then coalesce(route_row.minimum_payout_minor,0)
      else 0
    end,
    coalesce(limit_row.minimum_payout_minor,0)
  );
  if p_amount_minor<minimum_value then
    raise exception 'Requested amount is below the minimum payout' using errcode='P0001';
  end if;

  maximum_value := null;
  select min(v) into maximum_value
  from unnest(array[
    source_currency_row.maximum_payout_minor,
    case when method_row.currency=upper(btrim(p_source_currency)) then country_row.maximum_payout_minor else null end,
    case when method_row.currency=upper(btrim(p_source_currency)) then route_row.maximum_payout_minor else null end,
    limit_row.maximum_payout_minor
  ]::bigint[]) v
  where v is not null;
  if maximum_value is not null and p_amount_minor>maximum_value then
    raise exception 'Requested amount exceeds the maximum payout' using errcode='P0001';
  end if;

  select
    coalesce(sum(amount_minor),0)::bigint,
    count(*)::integer
  into daily_sum,daily_count
  from public.payouts
  where owner_user_id=p_owner_user_id
    and currency=upper(btrim(p_source_currency))
    and created_at>=date_trunc('day',now())
    and status not in ('rejected','cancelled','failed','returned','draft');

  select
    coalesce(sum(amount_minor),0)::bigint,
    count(*)::integer
  into weekly_sum,weekly_count
  from public.payouts
  where owner_user_id=p_owner_user_id
    and currency=upper(btrim(p_source_currency))
    and created_at>=date_trunc('week',now())
    and status not in ('rejected','cancelled','failed','returned','draft');

  select
    coalesce(sum(amount_minor),0)::bigint,
    count(*)::integer
  into monthly_sum,monthly_count
  from public.payouts
  where owner_user_id=p_owner_user_id
    and currency=upper(btrim(p_source_currency))
    and created_at>=date_trunc('month',now())
    and status not in ('rejected','cancelled','failed','returned','draft');

  if limit_row.daily_maximum_minor is not null and daily_sum+p_amount_minor>limit_row.daily_maximum_minor then
    raise exception 'Daily payout limit would be exceeded' using errcode='P0001';
  end if;
  if limit_row.weekly_maximum_minor is not null and weekly_sum+p_amount_minor>limit_row.weekly_maximum_minor then
    raise exception 'Weekly payout limit would be exceeded' using errcode='P0001';
  end if;
  if limit_row.monthly_maximum_minor is not null and monthly_sum+p_amount_minor>limit_row.monthly_maximum_minor then
    raise exception 'Monthly payout limit would be exceeded' using errcode='P0001';
  end if;
  if limit_row.daily_request_count is not null and daily_count>=limit_row.daily_request_count then
    raise exception 'Daily payout request limit reached' using errcode='P0001';
  end if;
  if limit_row.weekly_request_count is not null and weekly_count>=limit_row.weekly_request_count then
    raise exception 'Weekly payout request limit reached' using errcode='P0001';
  end if;
  if limit_row.monthly_request_count is not null and monthly_count>=limit_row.monthly_request_count then
    raise exception 'Monthly payout request limit reached' using errcode='P0001';
  end if;

  select fr.* into provider_fee_rule
  from public.payout_fee_rules fr
  where fr.enabled=true and fr.fee_kind='provider'
    and (fr.account_type is null or fr.account_type=profile_row.account_type)
    and (fr.plan_segment is null or fr.plan_segment=plan_segment)
    and (fr.country_code is null or fr.country_code=method_row.country_code)
    and (fr.currency_code is null or fr.currency_code=upper(btrim(p_source_currency)))
    and (fr.method_id is null or fr.method_id=method_row.route_method_id)
    and (fr.provider_id is null or fr.provider_id=route_row.provider_id)
  order by
    ((fr.account_type is not null)::int
     +(fr.plan_segment is not null)::int
     +(fr.country_code is not null)::int
     +(fr.currency_code is not null)::int
     +(fr.method_id is not null)::int
     +(fr.provider_id is not null)::int) desc,
    fr.priority asc
  limit 1;

  select fr.* into nexo_fee_rule
  from public.payout_fee_rules fr
  where fr.enabled=true and fr.fee_kind='nexo'
    and (fr.account_type is null or fr.account_type=profile_row.account_type)
    and (fr.plan_segment is null or fr.plan_segment=plan_segment)
    and (fr.country_code is null or fr.country_code=method_row.country_code)
    and (fr.currency_code is null or fr.currency_code=upper(btrim(p_source_currency)))
    and (fr.method_id is null or fr.method_id=method_row.route_method_id)
    and (fr.provider_id is null or fr.provider_id=route_row.provider_id)
  order by
    ((fr.account_type is not null)::int
     +(fr.plan_segment is not null)::int
     +(fr.country_code is not null)::int
     +(fr.currency_code is not null)::int
     +(fr.method_id is not null)::int
     +(fr.provider_id is not null)::int) desc,
    fr.priority asc
  limit 1;

  provider_fee_value :=
    coalesce(provider_fee_rule.fixed_fee_minor,0)
    + round((p_amount_minor::numeric*coalesce(provider_fee_rule.percentage_bps,0)::numeric)/10000)::bigint;
  nexo_fee_value :=
    coalesce(nexo_fee_rule.fixed_fee_minor,0)
    + round((p_amount_minor::numeric*coalesce(nexo_fee_rule.percentage_bps,0)::numeric)/10000)::bigint;

  recipient_provider_fee := case coalesce(provider_fee_rule.fee_payer,'recipient')
    when 'nexo' then 0
    when 'split' then round((provider_fee_value::numeric*coalesce(provider_fee_rule.split_recipient_bps,5000))/10000)::bigint
    else provider_fee_value
  end;
  recipient_nexo_fee := case coalesce(nexo_fee_rule.fee_payer,'recipient')
    when 'nexo' then 0
    when 'split' then round((nexo_fee_value::numeric*coalesce(nexo_fee_rule.split_recipient_bps,5000))/10000)::bigint
    else nexo_fee_value
  end;

  if method_row.currency<>upper(btrim(p_source_currency)) then
    if not source_currency_row.fx_enabled or not destination_currency_row.fx_enabled then
      raise exception 'Currency conversion is not enabled for this payout route' using errcode='P0001';
    end if;
    select fx.* into fx_row
    from public.payout_fx_rates fx
    where fx.source_currency=upper(btrim(p_source_currency))
      and fx.destination_currency=method_row.currency
      and fx.enabled=true
      and fx.effective_at<=now()
      and (fx.expires_at is null or fx.expires_at>now())
    order by fx.effective_at desc
    limit 1;
    if not found then
      raise exception 'A current exchange rate is not available for this payout route' using errcode='P0001';
    end if;
    fx_fee_value :=
      round((p_amount_minor::numeric*source_currency_row.fx_fee_bps::numeric)/10000)::bigint;
    nexo_fee_value := nexo_fee_value
      + round((p_amount_minor::numeric*source_currency_row.nexo_fx_markup_bps::numeric)/10000)::bigint;
    recipient_fx_fee := case source_currency_row.fx_fee_payer
      when 'nexo' then 0
      when 'split' then round((fx_fee_value::numeric*source_currency_row.fx_split_recipient_bps)/10000)::bigint
      else fx_fee_value
    end;
  end if;

  net_source := p_amount_minor-recipient_provider_fee-recipient_nexo_fee-recipient_fx_fee;
  if net_source<=0 then
    raise exception 'Configured fees exceed the payout amount' using errcode='P0001';
  end if;

  if method_row.currency=upper(btrim(p_source_currency)) then
    net_destination := net_source;
  else
    net_destination :=
      round((net_source::numeric*fx_row.rate_numerator::numeric)/fx_row.rate_denominator::numeric)::bigint;
    if net_destination<=0 then
      raise exception 'FX conversion produced an invalid recipient amount' using errcode='P0001';
    end if;
  end if;

  insert into public.ledger_accounts(owner_user_id,currency,label)
  values (p_owner_user_id,upper(btrim(p_source_currency)),'default')
  on conflict (owner_user_id,currency,label) do nothing;

  select id into account_id from public.ledger_accounts
  where owner_user_id=p_owner_user_id
    and currency=upper(btrim(p_source_currency))
    and label='default';

  insert into public.payouts(
    owner_user_id,amount_minor,currency,status,method,idempotency_key,
    created_by,ledger_account_id,min_threshold_minor,eligibility_notes,
    payout_method_id,destination_mask,provider_name,provider_id,route_id,
    account_type,beneficiary_type,country_code,source_currency,destination_currency,
    gross_amount_minor,provider_fee_minor,nexo_fee_minor,fx_fee_minor,
    fx_rate_numerator,fx_rate_denominator,net_amount_minor,
    available_balance_at_request_minor,requested_at
  ) values (
    p_owner_user_id,p_amount_minor,upper(btrim(p_source_currency)),'pending',
    method_catalog.code,btrim(p_idempotency_key),actor,account_id,minimum_value,
    jsonb_build_object(
      'plan_segment',plan_segment,
      'identity_required',require_identity,
      'tax_required',require_tax
    )::text,
    method_row.id,method_row.destination_mask,provider_row.name,provider_row.id,route_row.id,
    profile_row.account_type,method_row.beneficiary_type,method_row.country_code,
    upper(btrim(p_source_currency)),method_row.currency,
    p_amount_minor,provider_fee_value,nexo_fee_value,fx_fee_value,
    case when fx_row.id is null then 1 else fx_row.rate_numerator end,
    case when fx_row.id is null then 1 else fx_row.rate_denominator end,
    net_destination,available_value,now()
  ) returning * into created;

  insert into public.payout_events(
    payout_id,owner_user_id,event_type,status,actor_user_id,actor_role,description,metadata
  ) values (
    created.id,created.owner_user_id,'requested',created.status,actor,profile_row.account_type,
    'Payout requested',
    jsonb_build_object('payout_reference',created.payout_reference)
  );

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values (
    actor,'payout_create','payout',created.id,
    jsonb_build_object(
      'payout_reference',created.payout_reference,
      'amount_minor',created.gross_amount_minor,
      'currency',created.source_currency,
      'method_id',created.payout_method_id,
      'provider_id',created.provider_id
    )
  );

  perform public.queue_payout_user_message(created,'requested',null);
  return created;
end;
$$;

revoke all on function public.create_configured_payout_request(uuid,bigint,text,uuid,text)
from public,anon;
grant execute on function public.create_configured_payout_request(uuid,bigint,text,uuid,text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Admin lifecycle. PAID and RETURNED remain dedicated atomic operations.
-- ---------------------------------------------------------------------------
create or replace function public.transition_payout_status(
  p_payout_id uuid,
  p_new_status public.payout_status,
  p_reason text default null
)
returns public.payouts
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  p public.payouts;
  old_status public.payout_status;
  allowed boolean := false;
  event_name text;
  audit_name public.audit_action;
begin
  if actor is null or not public.has_staff_permission(actor,'admin:payouts') then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  select * into p from public.payouts where id=p_payout_id for update;
  if not found then raise exception 'Payout not found' using errcode='P0002'; end if;
  old_status := p.status;

  if p_new_status in ('paid','returned','draft') then
    raise exception 'This status requires a dedicated financial operation' using errcode='42501';
  end if;

  allowed := case p.status
    when 'pending' then p_new_status in ('under_review','approved','cancelled','on_hold','rejected')
    when 'under_review' then p_new_status in ('approved','rejected','cancelled','on_hold','pending')
    when 'approved' then p_new_status in ('processing','cancelled','on_hold','rejected')
    when 'processing' then p_new_status in ('failed','on_hold')
    when 'on_hold' then p_new_status in ('pending','under_review','approved','cancelled','rejected')
    when 'failed' then p_new_status in ('under_review','cancelled')
    else false
  end;

  if not allowed then
    raise exception 'Invalid payout transition from % to %',p.status,p_new_status using errcode='P0001';
  end if;

  if p_new_status in ('rejected','failed','on_hold') and coalesce(btrim(p_reason),'')='' then
    raise exception 'Reason is required for this payout status' using errcode='P0001';
  end if;

  update public.payouts
  set status=p_new_status,
      reviewed_by=case when p_new_status in ('under_review','approved','rejected','on_hold') then actor else reviewed_by end,
      reviewed_at=case when p_new_status in ('under_review','approved','rejected','on_hold') then now() else reviewed_at end,
      approved_at=case when p_new_status='approved' then now() else approved_at end,
      processing_at=case when p_new_status='processing' then now() else processing_at end,
      failed_at=case when p_new_status='failed' then now() else failed_at end,
      cancelled_at=case when p_new_status='cancelled' then now() else cancelled_at end,
      rejected_reason=case when p_new_status='rejected' then btrim(p_reason) else rejected_reason end,
      failure_reason=case when p_new_status='failed' then btrim(p_reason) else failure_reason end,
      additional_information_reason=case
        when p_new_status='on_hold' then btrim(p_reason)
        when p_new_status in ('pending','under_review','approved') then null
        else additional_information_reason
      end,
      updated_at=now()
  where id=p_payout_id
  returning * into p;

  event_name := case
    when p_new_status='approved' then 'approved'
    when p_new_status='processing' then 'processing'
    when p_new_status='failed' then 'failed'
    when p_new_status='rejected' then 'rejected'
    when p_new_status='cancelled' then 'cancelled'
    when p_new_status='on_hold' then 'additional_information_requested'
    when p_new_status='under_review' then 'review_started'
    else 'resubmitted'
  end;

  audit_name := case
    when p_new_status='approved' then 'payout_approve'::public.audit_action
    when p_new_status='failed' then 'payout_failed'::public.audit_action
    when p_new_status='rejected' then 'payout_reject'::public.audit_action
    when p_new_status='on_hold' then 'payout_info_request'::public.audit_action
    else 'payout_status_change'::public.audit_action
  end;

  insert into public.payout_events(
    payout_id,owner_user_id,event_type,status,actor_user_id,actor_role,
    description,internal_note,metadata
  ) values (
    p.id,p.owner_user_id,event_name,p.status,actor,'staff',
    replace(initcap(replace(event_name,'_',' ')),'Payout ',''),
    case when p_new_status in ('failed','rejected','on_hold') then p_reason else null end,
    jsonb_build_object('previous_status',old_status::text,'new_status',p.status::text)
  );

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values (
    actor,audit_name,'payout',p.id,
    jsonb_strip_nulls(jsonb_build_object(
      'payout_reference',p.payout_reference,
      'previous_status',old_status::text,
      'new_status',p.status::text,
      'reason',p_reason
    ))
  );

  if p_new_status in ('approved','processing','failed','rejected','cancelled','on_hold') then
    perform public.queue_payout_user_message(p,event_name,p_reason);
  end if;
  return p;
end;
$$;

revoke all on function public.transition_payout_status(uuid,public.payout_status,text) from public,anon;
grant execute on function public.transition_payout_status(uuid,public.payout_status,text) to authenticated;

create or replace function public.resubmit_payout_after_information(p_payout_id uuid)
returns public.payouts
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  p public.payouts;
  pm public.payout_methods;
begin
  select * into p from public.payouts where id=p_payout_id for update;
  if not found or p.owner_user_id<>actor then
    raise exception 'Payout not found' using errcode='P0002';
  end if;
  if p.status<>'on_hold' then
    raise exception 'Payout is not waiting for additional information' using errcode='P0001';
  end if;
  select * into pm from public.payout_methods where id=p.payout_method_id and user_id=actor;
  if not found or pm.status<>'active' then
    raise exception 'An active payout method is required' using errcode='P0001';
  end if;
  if pm.security_hold_until is not null and pm.security_hold_until>now() then
    raise exception 'This payout method is temporarily on a security hold after a recent change' using errcode='P0001';
  end if;

  update public.payouts
  set status='pending',additional_information_reason=null,updated_at=now()
  where id=p.id returning * into p;

  insert into public.payout_events(
    payout_id,owner_user_id,event_type,status,actor_user_id,actor_role,description
  ) values (p.id,p.owner_user_id,'information_resubmitted',p.status,actor,'account','Information resubmitted');

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values (actor,'payout_status_change','payout',p.id,jsonb_build_object('new_status','pending','reason','information_resubmitted'));

  perform public.queue_payout_user_message(p,'resubmitted',null);
  return p;
end;
$$;

revoke all on function public.resubmit_payout_after_information(uuid) from public,anon;
grant execute on function public.resubmit_payout_after_information(uuid) to authenticated;

create or replace function public.retry_failed_payout(p_payout_id uuid,p_reason text default null)
returns public.payouts
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid:=auth.uid();
  p public.payouts;
  available_value bigint:=0;
begin
  if actor is null or not public.has_staff_permission(actor,'admin:payouts') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  select * into p from public.payouts where id=p_payout_id for update;
  if not found then raise exception 'Payout not found' using errcode='P0002'; end if;
  if p.status<>'failed' then
    raise exception 'Only failed payouts can be retried' using errcode='P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p.owner_user_id::text||':'||p.currency));
  select coalesce(available_minor,0) into available_value
  from public.ledger_balances
  where owner_user_id=p.owner_user_id and currency=p.currency;
  if available_value<p.amount_minor then
    raise exception 'Available balance is no longer sufficient to retry this payout' using errcode='P0001';
  end if;

  update public.payouts
  set status='pending',failure_code=null,failure_reason=null,failed_at=null,updated_at=now()
  where id=p.id returning * into p;

  insert into public.payout_events(
    payout_id,owner_user_id,event_type,status,actor_user_id,actor_role,description,internal_note
  ) values (p.id,p.owner_user_id,'retried',p.status,actor,'staff','Failed payout returned to review',p_reason);

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values (actor,'payout_retry','payout',p.id,jsonb_build_object('payout_reference',p.payout_reference,'reason',coalesce(p_reason,'')));

  perform public.queue_payout_user_message(p,'requested',null);
  return p;
end;
$$;

revoke all on function public.retry_failed_payout(uuid,text) from public,anon;
grant execute on function public.retry_failed_payout(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Manual Grey / manual provider recording: APPROVED -> PROCESSING only.
-- This records real admin-entered payment evidence; it never pretends an API call occurred.
-- ---------------------------------------------------------------------------
create or replace function public.record_manual_payout_payment(
  p_payout_id uuid,
  p_provider_id uuid,
  p_provider_reference text,
  p_amount_sent_minor bigint,
  p_currency_sent text,
  p_recipient_amount_minor bigint,
  p_recipient_currency text,
  p_provider_fee_minor bigint default 0,
  p_nexo_fee_minor bigint default 0,
  p_fx_fee_minor bigint default 0,
  p_fx_rate_numerator bigint default null,
  p_fx_rate_denominator bigint default null,
  p_sent_at timestamptz default now(),
  p_admin_note text default null
)
returns public.payout_payment_records
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid:=auth.uid();
  p public.payouts;
  provider public.payout_providers;
  record_row public.payout_payment_records;
  attempt integer;
begin
  if actor is null or not public.has_staff_permission(actor,'admin:payouts') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if coalesce(btrim(p_provider_reference),'')='' then
    raise exception 'Provider transaction/reference ID is required' using errcode='P0001';
  end if;
  if p_amount_sent_minor<=0 or p_recipient_amount_minor<0
     or p_provider_fee_minor<0 or p_nexo_fee_minor<0 or p_fx_fee_minor<0 then
    raise exception 'Payment amounts are invalid' using errcode='P0001';
  end if;
  if upper(btrim(p_currency_sent)) !~ '^[A-Z]{3}$'
     or upper(btrim(p_recipient_currency)) !~ '^[A-Z]{3}$' then
    raise exception 'Valid ISO currencies are required' using errcode='P0001';
  end if;

  select * into p from public.payouts where id=p_payout_id for update;
  if not found then raise exception 'Payout not found' using errcode='P0002'; end if;
  if p.status='paid' then
    raise exception 'This payout has already been processed' using errcode='P0001';
  end if;
  if p.status not in ('approved','processing') then
    raise exception 'Payout must be approved before recording payment' using errcode='P0001';
  end if;

  select * into provider from public.payout_providers where id=p_provider_id;
  if not found or not provider.enabled or not provider.manual_payout_enabled then
    raise exception 'Provider is not enabled for manual payout processing' using errcode='P0001';
  end if;

  if exists (
    select 1 from public.payout_payment_records
    where provider_id=p_provider_id and provider_reference=btrim(p_provider_reference)
      and payout_id<>p_payout_id
  ) then
    raise exception 'Provider reference is already attached to another payout' using errcode='23505';
  end if;

  select coalesce(max(attempt_no),0)+1 into attempt
  from public.payout_payment_records where payout_id=p_payout_id;

  insert into public.payout_payment_records(
    payout_id,attempt_no,provider_id,provider_reference,
    amount_sent_minor,currency_sent,recipient_amount_minor,recipient_currency,
    provider_fee_minor,nexo_fee_minor,fx_fee_minor,
    fx_rate_numerator,fx_rate_denominator,sent_at,admin_note,recorded_by
  ) values (
    p.id,attempt,provider.id,btrim(p_provider_reference),
    p_amount_sent_minor,upper(btrim(p_currency_sent)),
    p_recipient_amount_minor,upper(btrim(p_recipient_currency)),
    p_provider_fee_minor,p_nexo_fee_minor,p_fx_fee_minor,
    p_fx_rate_numerator,p_fx_rate_denominator,p_sent_at,
    nullif(btrim(p_admin_note),''),actor
  ) returning * into record_row;

  update public.payouts
  set status='processing',
      provider_id=provider.id,
      provider_name=provider.name,
      provider_transaction_id=btrim(p_provider_reference),
      provider_payout_id=btrim(p_provider_reference),
      provider_fee_minor=p_provider_fee_minor,
      nexo_fee_minor=p_nexo_fee_minor,
      fx_fee_minor=p_fx_fee_minor,
      net_amount_minor=p_recipient_amount_minor,
      destination_currency=upper(btrim(p_recipient_currency)),
      fx_rate_numerator=coalesce(p_fx_rate_numerator,fx_rate_numerator),
      fx_rate_denominator=coalesce(p_fx_rate_denominator,fx_rate_denominator),
      processing_at=coalesce(processing_at,now()),
      payment_recorded_at=now(),
      payment_recorded_by=actor,
      admin_note=coalesce(nullif(btrim(p_admin_note),''),admin_note),
      updated_at=now()
  where id=p.id
  returning * into p;

  insert into public.payout_events(
    payout_id,owner_user_id,event_type,status,actor_user_id,actor_role,description,internal_note,
    metadata
  ) values (
    p.id,p.owner_user_id,'payment_recorded',p.status,actor,'staff','Payment recorded with provider',
    p_admin_note,
    jsonb_build_object('provider_id',provider.id,'provider_reference',btrim(p_provider_reference),'attempt_no',attempt)
  );

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values (
    actor,'payout_payment_record','payout',p.id,
    jsonb_build_object(
      'payout_reference',p.payout_reference,
      'provider_id',provider.id,
      'provider_reference',btrim(p_provider_reference),
      'attempt_no',attempt
    )
  );

  perform public.queue_payout_user_message(p,'processing',null);
  return record_row;
end;
$$;

revoke all on function public.record_manual_payout_payment(
  uuid,uuid,text,bigint,text,bigint,text,bigint,bigint,bigint,bigint,bigint,timestamptz,text
) from public,anon;
grant execute on function public.record_manual_payout_payment(
  uuid,uuid,text,bigint,text,bigint,text,bigint,bigint,bigint,bigint,bigint,timestamptz,text
) to authenticated;

-- Atomic paid settlement, idempotent on payout ID.
create or replace function public.complete_payout_paid(
  p_payout_id uuid,
  p_payment_reference text,
  p_provider_name text default null,
  p_provider_payout_id text default null
)
returns public.payouts
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid:=auth.uid();
  p public.payouts;
  account_id uuid;
begin
  if actor is null or not public.has_staff_permission(actor,'admin:payouts') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if coalesce(btrim(p_payment_reference),'')='' then
    raise exception 'Provider payment reference is required' using errcode='P0001';
  end if;

  select * into p from public.payouts where id=p_payout_id for update;
  if not found then raise exception 'Payout not found' using errcode='P0002'; end if;
  if p.status='paid' then return p; end if;
  if p.status<>'processing' then
    raise exception 'PAID is only allowed from PROCESSING' using errcode='P0001';
  end if;

  if coalesce(p.provider_name,p_provider_name,'') in ('Grey Business','manual','Manual Bank Transfer')
     and not exists (
       select 1 from public.payout_payment_records r
       where r.payout_id=p.id
         and r.provider_reference=btrim(p_payment_reference)
     ) then
    raise exception 'Record the manual provider payment before marking this payout paid' using errcode='P0001';
  end if;

  perform set_config('nexo.trusted_financial_transition','1',true);

  update public.payouts
  set status='paid',
      payment_reference=btrim(p_payment_reference),
      provider_name=coalesce(nullif(btrim(p_provider_name),''),provider_name),
      provider_payout_id=coalesce(nullif(btrim(p_provider_payout_id),''),provider_payout_id,btrim(p_payment_reference)),
      provider_transaction_id=coalesce(provider_transaction_id,nullif(btrim(p_provider_payout_id),''),btrim(p_payment_reference)),
      paid_at=now(),
      updated_at=now()
  where id=p.id
  returning * into p;

  perform set_config('nexo.trusted_financial_transition','0',true);

  insert into public.ledger_accounts(owner_user_id,currency,label)
  values (p.owner_user_id,p.currency,'default')
  on conflict (owner_user_id,currency,label) do nothing;

  select id into account_id from public.ledger_accounts
  where owner_user_id=p.owner_user_id and currency=p.currency and label='default';

  if not exists (
    select 1 from public.ledger_entries le
    where le.payout_id=p.id and le.kind='payout'
  ) then
    insert into public.ledger_entries(
      account_id,owner_user_id,kind,amount_minor,currency,description,
      reference_type,reference_id,created_by,balance_bucket,payout_id,
      net_minor,gross_minor,metadata
    ) values (
      account_id,p.owner_user_id,'payout',-p.amount_minor,p.currency,
      'Payout '||p.payout_reference,'payout',p.id,actor,'paid',p.id,
      -p.amount_minor,-p.amount_minor,
      jsonb_build_object(
        'transaction_type','PAYOUT',
        'payout_reference',p.payout_reference,
        'provider',p.provider_name,
        'provider_reference',p.payment_reference
      )
    );
  end if;

  insert into public.payout_events(
    payout_id,owner_user_id,event_type,status,actor_user_id,actor_role,description,
    metadata
  ) values (
    p.id,p.owner_user_id,'paid',p.status,actor,'staff','Payout completed',
    jsonb_build_object('provider_reference',p.payment_reference)
  );

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values (
    actor,'payout_paid','payout',p.id,
    jsonb_build_object(
      'payout_reference',p.payout_reference,
      'provider',p.provider_name,
      'provider_reference',p.payment_reference
    )
  );

  perform public.queue_payout_user_message(p,'paid',null);
  return p;
end;
$$;

revoke all on function public.complete_payout_paid(uuid,text,text,text) from public,anon;
grant execute on function public.complete_payout_paid(uuid,text,text,text) to authenticated;

-- Returned payments preserve the original payout debit and post a new compensating
-- ledger entry in the paid bucket. Because RETURNED is not reserved, available
-- balance returns to the pre-payout amount without rewriting history.
create or replace function public.mark_payout_returned(
  p_payout_id uuid,
  p_reason text,
  p_provider_reference text default null
)
returns public.payouts
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid:=auth.uid();
  p public.payouts;
  account_id uuid;
  payout_entry uuid;
begin
  if actor is null or not public.has_staff_permission(actor,'admin:payouts') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if coalesce(btrim(p_reason),'')='' then
    raise exception 'Return reason is required' using errcode='P0001';
  end if;

  select * into p from public.payouts where id=p_payout_id for update;
  if not found then raise exception 'Payout not found' using errcode='P0002'; end if;
  if p.status='returned' then return p; end if;
  if p.status<>'paid' then
    raise exception 'Only a paid payout can be marked returned' using errcode='P0001';
  end if;

  select le.id,le.account_id into payout_entry,account_id
  from public.ledger_entries le
  where le.payout_id=p.id and le.kind='payout'
  order by le.created_at desc
  limit 1;
  if payout_entry is null then
    raise exception 'Original payout ledger entry not found' using errcode='P0001';
  end if;

  if not exists (
    select 1 from public.ledger_entries le
    where le.payout_id=p.id
      and le.kind='refund'
      and le.compensating_for=payout_entry
  ) then
    insert into public.ledger_entries(
      account_id,owner_user_id,kind,amount_minor,currency,description,
      reference_type,reference_id,created_by,balance_bucket,payout_id,
      compensating_for,net_minor,gross_minor,metadata
    ) values (
      account_id,p.owner_user_id,'refund',p.amount_minor,p.currency,
      'Returned payout '||p.payout_reference,'payout_return',p.id,actor,'paid',p.id,
      payout_entry,p.amount_minor,p.amount_minor,
      jsonb_build_object(
        'transaction_type','PAYOUT_RETURNED',
        'payout_reference',p.payout_reference,
        'return_reason',btrim(p_reason)
      )
    );
  end if;

  perform set_config('nexo.trusted_financial_transition','1',true);
  update public.payouts
  set status='returned',
      returned_at=now(),
      failure_reason=btrim(p_reason),
      provider_transaction_id=coalesce(nullif(btrim(p_provider_reference),''),provider_transaction_id),
      updated_at=now()
  where id=p.id returning * into p;
  perform set_config('nexo.trusted_financial_transition','0',true);

  insert into public.payout_events(
    payout_id,owner_user_id,event_type,status,actor_user_id,actor_role,description,internal_note
  ) values (
    p.id,p.owner_user_id,'returned',p.status,actor,'staff','Payout returned',btrim(p_reason)
  );

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values (
    actor,'payout_returned','payout',p.id,
    jsonb_build_object('payout_reference',p.payout_reference,'reason',btrim(p_reason))
  );

  perform public.queue_payout_user_message(p,'returned',btrim(p_reason));
  return p;
end;
$$;

revoke all on function public.mark_payout_returned(uuid,text,text) from public,anon;
grant execute on function public.mark_payout_returned(uuid,text,text) to authenticated;

-- Security hold override never deletes the evidence.
create or replace function public.override_payout_method_security_hold(
  p_method_id uuid,
  p_reason text
)
returns public.payout_methods
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid:=auth.uid();
  pm public.payout_methods;
begin
  if actor is null or not public.has_staff_permission(actor,'admin:payouts') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if coalesce(btrim(p_reason),'')='' then
    raise exception 'Override reason is required' using errcode='P0001';
  end if;

  update public.payout_methods
  set security_hold_until=null,updated_by_admin=actor,updated_at=now()
  where id=p_method_id
  returning * into pm;
  if not found then raise exception 'Payout method not found' using errcode='P0002'; end if;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values (
    actor,'payout_security_override','payout_method',pm.id,
    jsonb_build_object('owner_user_id',pm.user_id,'reason',btrim(p_reason))
  );
  return pm;
end;
$$;

revoke all on function public.override_payout_method_security_hold(uuid,text) from public,anon;
grant execute on function public.override_payout_method_security_hold(uuid,text) to authenticated;

-- Helpful indexes for admin search/filter pages.
create index if not exists payouts_owner_status_created_idx
  on public.payouts(owner_user_id,status,created_at desc);
create index if not exists payouts_paid_at_idx
  on public.payouts(paid_at desc) where paid_at is not null;
create index if not exists payouts_provider_reference_search_idx
  on public.payouts(provider_transaction_id) where provider_transaction_id is not null;
create index if not exists payout_methods_beneficiary_name_idx
  on public.payout_methods(lower(beneficiary_name));

-- Realtime uses existing focused portal/admin refresh components.
alter publication supabase_realtime add table public.payout_events;
