-- NEXO Music Distribution — Batch 7: Royalties, Publishing & Finance
-- Additive AFTER 20260913200004. Extends Batch 5 finance stubs.
-- Integer minor units + ISO currency. Append-only ledger. No fake data.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (new domain types)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.royalty_import_status as enum (
    'pending', 'processing', 'completed', 'failed', 'partial'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.royalty_row_match_status as enum (
    'unmatched', 'matched', 'conflict', 'ignored', 'posted'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.split_party_role as enum (
    'artist', 'label', 'producer', 'songwriter', 'featured', 'publisher', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ledger_balance_bucket as enum (
    'available', 'pending', 'paid', 'held'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.publishing_registration_status as enum (
    'draft', 'pending', 'submitted', 'registered', 'conflict', 'unavailable'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.publishing_right_type as enum (
    'performance', 'mechanical', 'sync', 'print', 'international'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.publishing_party_kind as enum (
    'writer', 'publisher', 'admin', 'other'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Harden ledger_entries (extend Batch 5 columns)
-- ---------------------------------------------------------------------------
alter table public.ledger_entries
  add column if not exists gross_minor bigint,
  add column if not exists net_minor bigint,
  add column if not exists share_bps integer check (share_bps is null or (share_bps >= 0 and share_bps <= 10000)),
  add column if not exists deduction_minor bigint not null default 0,
  add column if not exists fee_minor bigint not null default 0,
  add column if not exists adjustment_minor bigint not null default 0,
  add column if not exists source_provider text,
  add column if not exists source_report_id text,
  add column if not exists source_row_key text,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists release_id uuid references public.releases (id) on delete set null,
  add column if not exists track_id uuid references public.release_tracks (id) on delete set null,
  add column if not exists isrc text,
  add column if not exists upc text,
  add column if not exists territory char(2),
  add column if not exists dsp_code text,
  add column if not exists external_ref text,
  add column if not exists balance_bucket public.ledger_balance_bucket not null default 'pending',
  add column if not exists import_row_id uuid,
  add column if not exists split_rule_id uuid,
  add column if not exists statement_id uuid references public.royalty_statements (id) on delete set null,
  add column if not exists payout_id uuid references public.payouts (id) on delete set null,
  add column if not exists compensating_for uuid references public.ledger_entries (id) on delete restrict,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists ledger_entries_source_idempotency_uidx
  on public.ledger_entries (source_provider, source_report_id, source_row_key)
  where source_provider is not null and source_report_id is not null and source_row_key is not null;

create index if not exists ledger_entries_period_idx
  on public.ledger_entries (period_start, period_end);
create index if not exists ledger_entries_release_idx
  on public.ledger_entries (release_id) where release_id is not null;
create index if not exists ledger_entries_track_idx
  on public.ledger_entries (track_id) where track_id is not null;
create index if not exists ledger_entries_bucket_idx
  on public.ledger_entries (owner_user_id, currency, balance_bucket);
create index if not exists ledger_entries_dsp_idx
  on public.ledger_entries (dsp_code) where dsp_code is not null;

comment on table public.ledger_entries is
  'Append-only royalty ledger. Corrections via compensating adjustments only. Integer minor units + ISO currency.';

-- ---------------------------------------------------------------------------
-- Royalty import batches + rows (idempotent)
-- ---------------------------------------------------------------------------
create table if not exists public.royalty_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_provider text not null,
  report_id text not null,
  report_period_start date,
  report_period_end date,
  currency char(3),
  status public.royalty_import_status not null default 'pending',
  row_count integer not null default 0,
  matched_count integer not null default 0,
  conflict_count integer not null default 0,
  posted_count integer not null default 0,
  error_summary text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (source_provider, report_id)
);

create index if not exists royalty_import_batches_status_idx
  on public.royalty_import_batches (status, created_at desc);

create table if not exists public.royalty_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.royalty_import_batches (id) on delete cascade,
  source_provider text not null,
  report_id text not null,
  row_key text not null,
  match_status public.royalty_row_match_status not null default 'unmatched',
  conflict_reason text,
  raw jsonb not null default '{}'::jsonb,
  amount_minor bigint,
  currency char(3),
  isrc text,
  upc text,
  territory char(2),
  dsp_code text,
  release_id uuid references public.releases (id) on delete set null,
  track_id uuid references public.release_tracks (id) on delete set null,
  owner_user_id uuid references public.profiles (id) on delete set null,
  period_start date,
  period_end date,
  posted_ledger_entry_id uuid references public.ledger_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_provider, report_id, row_key)
);

create index if not exists royalty_import_rows_batch_idx
  on public.royalty_import_rows (batch_id, match_status);
create index if not exists royalty_import_rows_match_idx
  on public.royalty_import_rows (match_status, created_at desc);

-- FK from ledger to import row (deferred until table exists)
do $$ begin
  alter table public.ledger_entries
    add constraint ledger_entries_import_row_fk
    foreign key (import_row_id) references public.royalty_import_rows (id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Split rules (historical reproducibility — never rewrite past calc)
-- ---------------------------------------------------------------------------
create table if not exists public.royalty_split_rules (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  scope_type text not null default 'account'
    check (scope_type in ('account', 'release', 'track', 'label')),
  scope_release_id uuid references public.releases (id) on delete cascade,
  scope_track_id uuid references public.release_tracks (id) on delete cascade,
  effective_from date not null default current_date,
  effective_to date,
  currency char(3),
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint royalty_split_rules_dates check (effective_to is null or effective_to >= effective_from)
);

create index if not exists royalty_split_rules_owner_idx
  on public.royalty_split_rules (owner_user_id, is_active, effective_from desc);

drop trigger if exists royalty_split_rules_set_updated_at on public.royalty_split_rules;
create trigger royalty_split_rules_set_updated_at
  before update on public.royalty_split_rules
  for each row execute function public.set_updated_at();

create table if not exists public.royalty_split_shares (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.royalty_split_rules (id) on delete cascade,
  party_user_id uuid references public.profiles (id) on delete set null,
  party_name text not null,
  party_role public.split_party_role not null default 'other',
  share_bps integer not null check (share_bps >= 0 and share_bps <= 10000),
  created_at timestamptz not null default now()
);

create index if not exists royalty_split_shares_rule_idx
  on public.royalty_split_shares (rule_id);

-- Validate shares sum ≤ 10000 bps per rule
create or replace function public.validate_split_rule_shares()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
  rid uuid;
begin
  rid := coalesce(new.rule_id, old.rule_id);
  select coalesce(sum(share_bps), 0) into total
  from public.royalty_split_shares where rule_id = rid;
  if total > 10000 then
    raise exception 'Split shares exceed 100%% (bps=%)', total using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists royalty_split_shares_validate on public.royalty_split_shares;
create trigger royalty_split_shares_validate
  after insert or update or delete on public.royalty_split_shares
  for each row execute function public.validate_split_rule_shares();

-- Prevent silent rewrite of historical split shares once a ledger entry references the rule
create or replace function public.protect_split_rule_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.ledger_entries le where le.split_rule_id = old.id
  ) then
    if tg_op = 'DELETE' then
      raise exception 'Cannot delete split rule referenced by ledger entries' using errcode = '42501';
    end if;
    -- Allow only effective_to / is_active / notes / updated_at changes — not name/scope rewrite
    if new.owner_user_id is distinct from old.owner_user_id
      or new.scope_type is distinct from old.scope_type
      or new.scope_release_id is distinct from old.scope_release_id
      or new.scope_track_id is distinct from old.scope_track_id
      or new.effective_from is distinct from old.effective_from
    then
      raise exception 'Historical split rules are immutable; create a new rule with new effective dates'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists royalty_split_rules_protect_history on public.royalty_split_rules;
create trigger royalty_split_rules_protect_history
  before update or delete on public.royalty_split_rules
  for each row execute function public.protect_split_rule_history();

create or replace function public.protect_split_shares_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid := coalesce(new.rule_id, old.rule_id);
begin
  if exists (select 1 from public.ledger_entries le where le.split_rule_id = rid) then
    raise exception 'Cannot alter split shares for rules already used in ledger calculations'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists royalty_split_shares_protect_history on public.royalty_split_shares;
create trigger royalty_split_shares_protect_history
  before update or delete on public.royalty_split_shares
  for each row execute function public.protect_split_shares_history();

do $$ begin
  alter table public.ledger_entries
    add constraint ledger_entries_split_rule_fk
    foreign key (split_rule_id) references public.royalty_split_rules (id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Derived balances view (not editable)
-- ---------------------------------------------------------------------------
create or replace view public.ledger_balances
with (security_invoker = true)
as
select
  owner_user_id,
  currency,
  coalesce(sum(amount_minor) filter (where balance_bucket = 'available'), 0)::bigint as available_minor,
  coalesce(sum(amount_minor) filter (where balance_bucket = 'pending'), 0)::bigint as pending_minor,
  coalesce(sum(amount_minor) filter (where balance_bucket = 'paid'), 0)::bigint as paid_minor,
  coalesce(sum(amount_minor) filter (where balance_bucket = 'held'), 0)::bigint as held_minor,
  coalesce(sum(amount_minor), 0)::bigint as total_minor
from public.ledger_entries
group by owner_user_id, currency;

comment on view public.ledger_balances is
  'Derived from ledger_entries. Never store editable balance fields.';

-- ---------------------------------------------------------------------------
-- Harden royalty_statements
-- ---------------------------------------------------------------------------
alter table public.royalty_statements
  add column if not exists opening_minor bigint not null default 0,
  add column if not exists earnings_minor bigint not null default 0,
  add column if not exists deductions_minor bigint not null default 0,
  add column if not exists adjustments_minor bigint not null default 0,
  add column if not exists payouts_minor bigint not null default 0,
  add column if not exists closing_minor bigint not null default 0,
  add column if not exists scope_type text not null default 'owner'
    check (scope_type in ('owner', 'artist', 'label', 'release', 'track')),
  add column if not exists scope_release_id uuid references public.releases (id) on delete set null,
  add column if not exists scope_track_id uuid references public.release_tracks (id) on delete set null,
  add column if not exists label text;

create index if not exists royalty_statements_owner_period_idx
  on public.royalty_statements (owner_user_id, period_end desc);

alter table public.royalty_line_items
  add column if not exists kind public.money_entry_kind,
  add column if not exists dsp_code text,
  add column if not exists territory char(2),
  add column if not exists isrc text,
  add column if not exists upc text,
  add column if not exists ledger_entry_id uuid references public.ledger_entries (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Payouts: eligibility + provider fields
-- ---------------------------------------------------------------------------
alter table public.payouts
  add column if not exists method text,
  add column if not exists destination_mask text,
  add column if not exists min_threshold_minor bigint,
  add column if not exists eligibility_notes text,
  add column if not exists compliance_hold boolean not null default false,
  add column if not exists provider_name text,
  add column if not exists provider_payout_id text,
  add column if not exists idempotency_key text,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejected_reason text,
  add column if not exists ledger_account_id uuid references public.ledger_accounts (id) on delete set null;

create unique index if not exists payouts_idempotency_uidx
  on public.payouts (owner_user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists payouts_provider_idx
  on public.payouts (provider_name, provider_payout_id)
  where provider_payout_id is not null;

-- Extend admin settings allowlist for finance keys
create or replace function public.validate_admin_setting()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.key not in (
    'qc.default_priority',
    'qc.auto_claim',
    'support.sla_hours',
    'contact.auto_assign',
    'operations.maintenance_notice',
    'reports.retention_days',
    'finance.min_payout_minor_usd',
    'finance.payouts_enabled'
  ) then
    raise exception 'Setting key is not allowlisted' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Platform settings for min payout threshold (non-secret)
insert into public.admin_settings (key, value, updated_by)
select 'finance.min_payout_minor_usd', '5000'::jsonb, null
where not exists (select 1 from public.admin_settings where key = 'finance.min_payout_minor_usd');

insert into public.admin_settings (key, value, updated_by)
select 'finance.payouts_enabled', 'true'::jsonb, null
where not exists (select 1 from public.admin_settings where key = 'finance.payouts_enabled');

-- ---------------------------------------------------------------------------
-- FX rates architecture (no silent conversion)
-- ---------------------------------------------------------------------------
create table if not exists public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency char(3) not null,
  quote_currency char(3) not null,
  rate_numeric numeric(24, 12) not null check (rate_numeric > 0),
  as_of_date date not null,
  source text not null default 'unavailable',
  created_at timestamptz not null default now(),
  unique (base_currency, quote_currency, as_of_date, source)
);

create index if not exists fx_rates_pair_idx
  on public.fx_rates (base_currency, quote_currency, as_of_date desc);

comment on table public.fx_rates is
  'FX rate table for future use. No silent FX — unavailable rates must not invent figures.';

-- ---------------------------------------------------------------------------
-- Payment webhook events (idempotent, audited)
-- ---------------------------------------------------------------------------
create table if not exists public.payout_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  event_id text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  signature_valid boolean not null default false,
  processed boolean not null default false,
  process_error text,
  payout_id uuid references public.payouts (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (provider_name, event_id)
);

create index if not exists payout_webhook_events_created_idx
  on public.payout_webhook_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Publishing (Nexo Publishing Group) — architecture; no fake collections
-- ---------------------------------------------------------------------------
create table if not exists public.publishing_works (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  iswc text,
  registration_status public.publishing_registration_status not null default 'draft',
  territories text[] not null default '{}',
  notes text,
  conflict_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publishing_works_owner_idx
  on public.publishing_works (owner_user_id, created_at desc);
create index if not exists publishing_works_iswc_idx
  on public.publishing_works (iswc) where iswc is not null;

drop trigger if exists publishing_works_set_updated_at on public.publishing_works;
create trigger publishing_works_set_updated_at
  before update on public.publishing_works
  for each row execute function public.set_updated_at();

create table if not exists public.publishing_parties (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles (id) on delete set null,
  display_name text not null,
  kind public.publishing_party_kind not null default 'writer',
  ipi_cae text,
  pro_cmo text,
  pro_affiliation text,
  territories text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publishing_parties_ipi_idx
  on public.publishing_parties (ipi_cae) where ipi_cae is not null;

drop trigger if exists publishing_parties_set_updated_at on public.publishing_parties;
create trigger publishing_parties_set_updated_at
  before update on public.publishing_parties
  for each row execute function public.set_updated_at();

create table if not exists public.publishing_shares (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.publishing_works (id) on delete cascade,
  party_id uuid not null references public.publishing_parties (id) on delete restrict,
  right_type public.publishing_right_type not null,
  share_bps integer not null check (share_bps >= 0 and share_bps <= 10000),
  territory char(2),
  created_at timestamptz not null default now(),
  unique (work_id, party_id, right_type, territory)
);

create index if not exists publishing_shares_work_idx
  on public.publishing_shares (work_id, right_type);

create or replace function public.validate_publishing_shares()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
  wid uuid;
  rtype public.publishing_right_type;
  terr char(2);
begin
  wid := coalesce(new.work_id, old.work_id);
  rtype := coalesce(new.right_type, old.right_type);
  terr := coalesce(new.territory, old.territory);
  select coalesce(sum(share_bps), 0) into total
  from public.publishing_shares
  where work_id = wid and right_type = rtype
    and territory is not distinct from terr;
  if total > 10000 then
    raise exception 'Publishing shares exceed 100%% for work/right/territory' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists publishing_shares_validate on public.publishing_shares;
create trigger publishing_shares_validate
  after insert or update or delete on public.publishing_shares
  for each row execute function public.validate_publishing_shares();

create table if not exists public.publishing_work_recordings (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.publishing_works (id) on delete cascade,
  release_id uuid references public.releases (id) on delete set null,
  track_id uuid references public.release_tracks (id) on delete set null,
  isrc text,
  conflict_state text check (conflict_state is null or conflict_state in ('none', 'possible', 'confirmed')),
  created_at timestamptz not null default now(),
  unique (work_id, track_id)
);

create index if not exists publishing_work_recordings_track_idx
  on public.publishing_work_recordings (track_id) where track_id is not null;

-- Collection claims architecture only — never invent collected amounts
create table if not exists public.publishing_collection_claims (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.publishing_works (id) on delete cascade,
  right_type public.publishing_right_type not null,
  source_provider text,
  status text not null default 'unavailable'
    check (status in ('unavailable', 'not_connected', 'pending', 'reported')),
  amount_minor bigint,
  currency char(3),
  period_start date,
  period_end date,
  notes text,
  created_at timestamptz not null default now(),
  constraint publishing_collection_no_fake check (
    status in ('unavailable', 'not_connected')
    or (amount_minor is not null and currency is not null and source_provider is not null)
  )
);

comment on table public.publishing_collection_claims is
  'Architecture only. Do not claim PRO registration or collected royalties without connected sources.';

-- ---------------------------------------------------------------------------
-- Compliance payout holds
-- ---------------------------------------------------------------------------
create table if not exists public.payout_compliance_holds (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  case_id uuid references public.compliance_cases (id) on delete set null,
  reason text not null,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles (id) on delete set null
);

create index if not exists payout_compliance_holds_owner_idx
  on public.payout_compliance_holds (owner_user_id, active);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.royalty_import_batches enable row level security;
alter table public.royalty_import_rows enable row level security;
alter table public.royalty_split_rules enable row level security;
alter table public.royalty_split_shares enable row level security;
alter table public.fx_rates enable row level security;
alter table public.payout_webhook_events enable row level security;
alter table public.publishing_works enable row level security;
alter table public.publishing_parties enable row level security;
alter table public.publishing_shares enable row level security;
alter table public.publishing_work_recordings enable row level security;
alter table public.publishing_collection_claims enable row level security;
alter table public.payout_compliance_holds enable row level security;

-- Staff / owner policies
drop policy if exists "royalty_import_batches_staff" on public.royalty_import_batches;
create policy "royalty_import_batches_staff" on public.royalty_import_batches
  for all using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "royalty_import_rows_staff" on public.royalty_import_rows;
create policy "royalty_import_rows_staff" on public.royalty_import_rows
  for all using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "royalty_import_rows_owner_select" on public.royalty_import_rows;
create policy "royalty_import_rows_owner_select" on public.royalty_import_rows
  for select using (owner_user_id = auth.uid());

drop policy if exists "royalty_split_rules_select" on public.royalty_split_rules;
create policy "royalty_split_rules_select" on public.royalty_split_rules
  for select using (
    owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid())
  );

drop policy if exists "royalty_split_rules_owner_write" on public.royalty_split_rules;
create policy "royalty_split_rules_owner_write" on public.royalty_split_rules
  for insert with check (owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists "royalty_split_rules_owner_update" on public.royalty_split_rules;
create policy "royalty_split_rules_owner_update" on public.royalty_split_rules
  for update using (owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists "royalty_split_shares_select" on public.royalty_split_shares;
create policy "royalty_split_shares_select" on public.royalty_split_shares
  for select using (
    public.is_admin_portal_staff(auth.uid())
    or exists (
      select 1 from public.royalty_split_rules r
      where r.id = rule_id and (r.owner_user_id = auth.uid() or party_user_id = auth.uid())
    )
  );

drop policy if exists "royalty_split_shares_write" on public.royalty_split_shares;
create policy "royalty_split_shares_write" on public.royalty_split_shares
  for all using (
    public.is_admin_portal_staff(auth.uid())
    or exists (select 1 from public.royalty_split_rules r where r.id = rule_id and r.owner_user_id = auth.uid())
  )
  with check (
    public.is_admin_portal_staff(auth.uid())
    or exists (select 1 from public.royalty_split_rules r where r.id = rule_id and r.owner_user_id = auth.uid())
  );

drop policy if exists "fx_rates_staff_select" on public.fx_rates;
create policy "fx_rates_staff_select" on public.fx_rates
  for select using (auth.uid() is not null);

drop policy if exists "fx_rates_staff_write" on public.fx_rates;
create policy "fx_rates_staff_write" on public.fx_rates
  for all using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "payout_webhook_events_staff" on public.payout_webhook_events;
create policy "payout_webhook_events_staff" on public.payout_webhook_events
  for select using (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "publishing_works_select" on public.publishing_works;
create policy "publishing_works_select" on public.publishing_works
  for select using (owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists "publishing_works_write" on public.publishing_works;
create policy "publishing_works_write" on public.publishing_works
  for all using (owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists "publishing_parties_select" on public.publishing_parties;
create policy "publishing_parties_select" on public.publishing_parties
  for select using (
    owner_user_id = auth.uid() or owner_user_id is null or public.is_admin_portal_staff(auth.uid())
  );

drop policy if exists "publishing_parties_write" on public.publishing_parties;
create policy "publishing_parties_write" on public.publishing_parties
  for all using (owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists "publishing_shares_select" on public.publishing_shares;
create policy "publishing_shares_select" on public.publishing_shares
  for select using (
    public.is_admin_portal_staff(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  );

drop policy if exists "publishing_shares_write" on public.publishing_shares;
create policy "publishing_shares_write" on public.publishing_shares
  for all using (
    public.is_admin_portal_staff(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  )
  with check (
    public.is_admin_portal_staff(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  );

drop policy if exists "publishing_work_recordings_select" on public.publishing_work_recordings;
create policy "publishing_work_recordings_select" on public.publishing_work_recordings
  for select using (
    public.is_admin_portal_staff(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  );

drop policy if exists "publishing_work_recordings_write" on public.publishing_work_recordings;
create policy "publishing_work_recordings_write" on public.publishing_work_recordings
  for all using (
    public.is_admin_portal_staff(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  )
  with check (
    public.is_admin_portal_staff(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  );

drop policy if exists "publishing_collection_claims_select" on public.publishing_collection_claims;
create policy "publishing_collection_claims_select" on public.publishing_collection_claims
  for select using (
    public.is_admin_portal_staff(auth.uid())
    or exists (select 1 from public.publishing_works w where w.id = work_id and w.owner_user_id = auth.uid())
  );

drop policy if exists "publishing_collection_claims_staff_write" on public.publishing_collection_claims;
create policy "publishing_collection_claims_staff_write" on public.publishing_collection_claims
  for all using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "payout_compliance_holds_select" on public.payout_compliance_holds;
create policy "payout_compliance_holds_select" on public.payout_compliance_holds
  for select using (owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists "payout_compliance_holds_staff" on public.payout_compliance_holds;
create policy "payout_compliance_holds_staff" on public.payout_compliance_holds
  for all using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

-- No client inserts into ledger — staff/service via SECURITY DEFINER only
drop policy if exists "ledger_entries_staff_insert" on public.ledger_entries;
-- intentionally no insert policy for authenticated; RPC only

comment on table public.royalty_import_batches is 'Royalty report import batches. Idempotent by source_provider+report_id. No sample data.';
comment on table public.publishing_works is 'Nexo Publishing Group works. Registration/collection claims require connected sources.';
