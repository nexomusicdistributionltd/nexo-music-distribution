-- NEXO Music Distribution — Batch 5: Admin & Operations Center
-- Additive. Depends on Batch 3 auth + Batch 4 releases.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.qc_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.qc_decision as enum ('approve', 'request_changes', 'reject');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.account_restriction_kind as enum ('none', 'submit_blocked', 'login_restricted', 'read_only');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.money_entry_kind as enum ('royalty_credit', 'royalty_debit', 'adjustment', 'fee', 'payout', 'reversal');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payout_status as enum (
    'pending',
    'approved',
    'processing',
    'paid',
    'failed',
    'cancelled',
    'on_hold'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.compliance_status as enum ('open', 'investigating', 'resolved', 'dismissed', 'escalated');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ticket_status as enum ('open', 'pending', 'awaiting_user', 'resolved', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.contact_status as enum ('new', 'triaged', 'replied', 'closed', 'spam');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.email_event_status as enum ('queued', 'skipped', 'failed', 'sent');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- QC queue + reviews
-- ---------------------------------------------------------------------------
create table if not exists public.qc_queue_items (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null unique references public.releases (id) on delete cascade,
  priority public.qc_priority not null default 'normal',
  assigned_to uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz,
  claimed_at timestamptz,
  status text not null default 'queued'
    check (status in ('queued', 'claimed', 'in_review', 'completed', 'released')),
  notes_internal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qc_queue_status_idx on public.qc_queue_items (status);
create index if not exists qc_queue_assigned_idx on public.qc_queue_items (assigned_to);
create index if not exists qc_queue_priority_idx on public.qc_queue_items (priority, created_at);

drop trigger if exists qc_queue_items_set_updated_at on public.qc_queue_items;
create trigger qc_queue_items_set_updated_at
  before update on public.qc_queue_items
  for each row execute function public.set_updated_at();

create table if not exists public.qc_reviews (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles (id) on delete restrict,
  decision public.qc_decision not null,
  checklist jsonb not null default '{}'::jsonb,
  artist_visible_reason text,
  internal_note text,
  previous_status public.release_status,
  new_status public.release_status not null,
  created_at timestamptz not null default now()
);

create index if not exists qc_reviews_release_idx on public.qc_reviews (release_id, created_at desc);
create index if not exists qc_reviews_reviewer_idx on public.qc_reviews (reviewer_user_id);

-- Auto-enqueue on submit / in_qc
create or replace function public.ensure_qc_queue_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if new.status in ('submitted', 'in_qc') then
      insert into public.qc_queue_items (release_id, status)
      values (new.id, case when new.status = 'in_qc' then 'in_review' else 'queued' end)
      on conflict (release_id) do update
        set status = case
              when public.qc_queue_items.status = 'completed' then excluded.status
              when new.status = 'in_qc' and public.qc_queue_items.status = 'queued' then 'in_review'
              else public.qc_queue_items.status
            end,
            updated_at = now();
    elsif new.status in ('approved', 'rejected', 'changes_requested') then
      update public.qc_queue_items
      set status = 'completed', updated_at = now()
      where release_id = new.id and status <> 'completed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists releases_ensure_qc_queue on public.releases;
create trigger releases_ensure_qc_queue
  after insert or update of status on public.releases
  for each row execute function public.ensure_qc_queue_item();

-- Claim with race protection
create or replace function public.claim_qc_item(p_item_id uuid)
returns public.qc_queue_items
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  item public.qc_queue_items;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into item from public.qc_queue_items where id = p_item_id for update;
  if not found then
    raise exception 'QC item not found' using errcode = 'P0002';
  end if;

  if item.assigned_to is not null and item.assigned_to <> actor and item.status in ('claimed', 'in_review') then
    raise exception 'QC item already claimed' using errcode = 'P0001';
  end if;

  update public.qc_queue_items
  set assigned_to = actor,
      assigned_at = coalesce(assigned_at, now()),
      claimed_at = now(),
      status = 'claimed',
      updated_at = now()
  where id = p_item_id
  returning * into item;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'qc_claim', 'qc_queue_item', item.id, jsonb_build_object('release_id', item.release_id));

  return item;
end;
$$;

revoke all on function public.claim_qc_item(uuid) from public;
grant execute on function public.claim_qc_item(uuid) to authenticated;

create or replace function public.release_qc_item(p_item_id uuid)
returns public.qc_queue_items
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  item public.qc_queue_items;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into item from public.qc_queue_items where id = p_item_id for update;
  if not found then
    raise exception 'QC item not found' using errcode = 'P0002';
  end if;

  if item.assigned_to is distinct from actor
     and not public.has_role(actor, 'admin')
     and not public.has_role(actor, 'super_admin') then
    raise exception 'Only assignee or admin can release claim' using errcode = '42501';
  end if;

  update public.qc_queue_items
  set assigned_to = null,
      assigned_at = null,
      claimed_at = null,
      status = 'queued',
      updated_at = now()
  where id = p_item_id
  returning * into item;

  return item;
end;
$$;

revoke all on function public.release_qc_item(uuid) from public;
grant execute on function public.release_qc_item(uuid) to authenticated;

-- Staff QC decision wrapping transition_release_status
create or replace function public.perform_qc_decision(
  p_release_id uuid,
  p_decision public.qc_decision,
  p_checklist jsonb default '{}'::jsonb,
  p_artist_visible_reason text default null,
  p_internal_note text default null
)
returns public.qc_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.releases;
  new_status public.release_status;
  review public.qc_reviews;
begin
  if actor is null or not (
    public.has_role(actor, 'admin')
    or public.has_role(actor, 'super_admin')
    or public.has_role(actor, 'support')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if r.status not in ('submitted', 'in_qc') then
    raise exception 'Release is not in a QC-able status' using errcode = 'P0001';
  end if;

  if p_decision = 'approve' then
    new_status := 'approved';
  elsif p_decision = 'request_changes' then
    new_status := 'changes_requested';
    if p_artist_visible_reason is null or length(trim(p_artist_visible_reason)) = 0 then
      raise exception 'Artist-visible reason required for request_changes' using errcode = 'P0001';
    end if;
  elsif p_decision = 'reject' then
    new_status := 'rejected';
    if p_artist_visible_reason is null or length(trim(p_artist_visible_reason)) = 0 then
      raise exception 'Artist-visible reason required for reject' using errcode = 'P0001';
    end if;
  else
    raise exception 'Invalid decision' using errcode = 'P0001';
  end if;

  -- Move to in_qc first when still submitted
  if r.status = 'submitted' then
    perform public.transition_release_status(
      p_release_id, 'in_qc', null,
      jsonb_build_object('source', 'perform_qc_decision', 'phase', 'claim')
    );
  end if;

  perform public.transition_release_status(
    p_release_id,
    new_status,
    p_artist_visible_reason,
    jsonb_build_object(
      'source', 'perform_qc_decision',
      'decision', p_decision::text,
      'internal_note', coalesce(p_internal_note, ''),
      'checklist', coalesce(p_checklist, '{}'::jsonb)
    )
  );

  insert into public.qc_reviews (
    release_id, reviewer_user_id, decision, checklist,
    artist_visible_reason, internal_note, previous_status, new_status
  ) values (
    p_release_id, actor, p_decision, coalesce(p_checklist, '{}'::jsonb),
    p_artist_visible_reason, p_internal_note, r.status, new_status
  ) returning * into review;

  update public.qc_queue_items
  set status = 'completed', assigned_to = coalesce(assigned_to, actor), updated_at = now()
  where release_id = p_release_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor, 'qc_review', 'release', p_release_id,
    jsonb_build_object('decision', p_decision::text, 'new_status', new_status::text)
  );

  return review;
end;
$$;

revoke all on function public.perform_qc_decision(uuid, public.qc_decision, jsonb, text, text) from public;
grant execute on function public.perform_qc_decision(uuid, public.qc_decision, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Account operational state
-- ---------------------------------------------------------------------------
create table if not exists public.account_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (action in ('suspend', 'deactivate', 'restore', 'restrict', 'unrestrict')),
  restriction_kind public.account_restriction_kind,
  reason text not null,
  artist_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists account_actions_target_idx on public.account_actions (target_user_id, created_at desc);

alter table public.profiles
  add column if not exists restriction_kind public.account_restriction_kind not null default 'none';

create or replace function public.admin_set_account_status(
  p_target uuid,
  p_status public.account_status,
  p_reason text,
  p_restriction public.account_restriction_kind default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  p public.profiles;
  act text;
begin
  if actor is null or not (
    public.has_role(actor, 'admin') or public.has_role(actor, 'super_admin')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Reason required' using errcode = 'P0001';
  end if;
  if public.has_role(p_target, 'super_admin') and not public.has_role(actor, 'super_admin') then
    raise exception 'Cannot modify super_admin' using errcode = '42501';
  end if;

  select * into p from public.profiles where id = p_target for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;

  act := case
    when p_status = 'suspended' then 'suspend'
    when p_status = 'deactivated' then 'deactivate'
    when p_status = 'active' then 'restore'
    else 'restrict'
  end;

  update public.profiles
  set account_status = p_status,
      restriction_kind = coalesce(p_restriction, restriction_kind),
      updated_at = now()
  where id = p_target
  returning * into p;

  insert into public.account_actions (target_user_id, actor_user_id, action, restriction_kind, reason)
  values (p_target, actor, act, coalesce(p_restriction, p.restriction_kind), p_reason);

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    case when act = 'restore' then 'account_restore'::public.audit_action
         when act = 'restrict' then 'account_restrict'::public.audit_action
         else 'account_suspend'::public.audit_action end,
    'profile', p_target,
    jsonb_build_object('status', p_status::text, 'reason', p_reason)
  );

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  values (
    p_target, 'account_status',
    'Account status updated',
    'Your account status is now ' || p_status::text || '.',
    'profile', p_target
  );

  return p;
end;
$$;

revoke all on function public.admin_set_account_status(uuid, public.account_status, text, public.account_restriction_kind) from public;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text, public.account_restriction_kind) to authenticated;

-- Privileged role changes: super_admin only
create or replace function public.super_admin_set_roles(
  p_target uuid,
  p_roles public.app_role[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.app_role;
begin
  if actor is null or not public.has_role(actor, 'super_admin') then
    raise exception 'super_admin required' using errcode = '42501';
  end if;
  if p_target = actor and not ('super_admin' = any (p_roles)) then
    raise exception 'Cannot remove own super_admin role' using errcode = 'P0001';
  end if;

  delete from public.user_roles where user_id = p_target;
  foreach r in array p_roles loop
    insert into public.user_roles (user_id, role) values (p_target, r)
    on conflict do nothing;
  end loop;

  update public.profiles
  set account_type = coalesce(p_roles[1]::text, account_type),
      updated_at = now()
  where id = p_target;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'role_change', 'profile', p_target, jsonb_build_object('roles', to_jsonb(p_roles)));
end;
$$;

revoke all on function public.super_admin_set_roles(uuid, public.app_role[]) from public;
grant execute on function public.super_admin_set_roles(uuid, public.app_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Finance (integer minor units + ISO currency)
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  currency char(3) not null default 'USD',
  label text not null default 'default',
  created_at timestamptz not null default now(),
  unique (owner_user_id, currency, label)
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ledger_accounts (id) on delete cascade,
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.money_entry_kind not null,
  amount_minor bigint not null,
  currency char(3) not null,
  description text,
  reference_type text,
  reference_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ledger_entries_nonzero check (amount_minor <> 0)
);

create index if not exists ledger_entries_owner_idx on public.ledger_entries (owner_user_id, created_at desc);
create index if not exists ledger_entries_account_idx on public.ledger_entries (account_id);

create table if not exists public.royalty_statements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  currency char(3) not null default 'USD',
  total_minor bigint not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'void')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.royalty_line_items (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.royalty_statements (id) on delete cascade,
  release_id uuid references public.releases (id) on delete set null,
  track_id uuid references public.release_tracks (id) on delete set null,
  description text not null default '',
  amount_minor bigint not null,
  currency char(3) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'USD',
  status public.payout_status not null default 'pending',
  payment_reference text,
  paid_at timestamptz,
  failure_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- PAID requires real payment_reference — enforced by trigger
  constraint payouts_paid_requires_ref check (
    status <> 'paid' or (payment_reference is not null and length(trim(payment_reference)) > 0 and paid_at is not null)
  )
);

create index if not exists payouts_owner_idx on public.payouts (owner_user_id, created_at desc);
create index if not exists payouts_status_idx on public.payouts (status);

drop trigger if exists payouts_set_updated_at on public.payouts;
create trigger payouts_set_updated_at
  before update on public.payouts
  for each row execute function public.set_updated_at();

create table if not exists public.payout_adjustments (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts (id) on delete cascade,
  amount_minor bigint not null,
  currency char(3) not null,
  reason text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Block casual delete / forged PAID
create or replace function public.protect_payout_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Payouts cannot be deleted; use adjustments or cancel' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.status = 'paid' then
      if new.payment_reference is null or length(trim(new.payment_reference)) = 0 or new.paid_at is null then
        raise exception 'PAID requires payment_reference and paid_at from a real payment operation' using errcode = 'P0001';
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

drop trigger if exists payouts_protect on public.payouts;
create trigger payouts_protect
  before update or delete on public.payouts
  for each row execute function public.protect_payout_row();

create or replace function public.protect_ledger_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Ledger entries are immutable' using errcode = '42501';
end;
$$;

drop trigger if exists ledger_entries_no_update on public.ledger_entries;
create trigger ledger_entries_no_update
  before update or delete on public.ledger_entries
  for each row execute function public.protect_ledger_immutable();

-- ---------------------------------------------------------------------------
-- Compliance
-- ---------------------------------------------------------------------------
create table if not exists public.compliance_cases (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid references public.profiles (id) on delete set null,
  release_id uuid references public.releases (id) on delete set null,
  title text not null,
  summary text,
  status public.compliance_status not null default 'open',
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compliance_cases_status_idx on public.compliance_cases (status, created_at desc);

drop trigger if exists compliance_cases_set_updated_at on public.compliance_cases;
create trigger compliance_cases_set_updated_at
  before update on public.compliance_cases
  for each row execute function public.set_updated_at();

create table if not exists public.compliance_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.compliance_cases (id) on delete cascade,
  storage_bucket text not null default 'compliance-evidence',
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

-- ---------------------------------------------------------------------------
-- Support tickets
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  status public.ticket_status not null default 'open',
  priority public.ticket_priority not null default 'normal',
  assigned_to uuid references public.profiles (id) on delete set null,
  related_release_id uuid references public.releases (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_requester_idx on public.support_tickets (requester_user_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status, updated_at desc);

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.support_messages (id) on delete cascade,
  storage_bucket text not null default 'support-attachments',
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

-- ---------------------------------------------------------------------------
-- Contact inbox
-- ---------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status public.contact_status not null default 'new',
  source_ip text,
  user_agent text,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);

drop trigger if exists contact_messages_set_updated_at on public.contact_messages;
create trigger contact_messages_set_updated_at
  before update on public.contact_messages
  for each row execute function public.set_updated_at();

-- Public insert via SECURITY DEFINER (rate-limit at app layer)
create or replace function public.submit_contact_message(
  p_name text,
  p_email text,
  p_subject text,
  p_message text,
  p_source_ip text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_name is null or length(trim(p_name)) < 2 then raise exception 'Invalid name'; end if;
  if p_email is null or p_email !~ '^[^@]+@[^@]+\.[^@]+$' then raise exception 'Invalid email'; end if;
  if p_subject is null or length(trim(p_subject)) < 2 then raise exception 'Invalid subject'; end if;
  if p_message is null or length(trim(p_message)) < 10 then raise exception 'Invalid message'; end if;

  insert into public.contact_messages (name, email, subject, message, source_ip, user_agent)
  values (trim(p_name), lower(trim(p_email)), trim(p_subject), trim(p_message), p_source_ip, p_user_agent)
  returning id into new_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (null, 'contact_message', 'contact_message', new_id, jsonb_build_object('email', lower(trim(p_email))));

  return new_id;
end;
$$;

revoke all on function public.submit_contact_message(text, text, text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Activity timeline (operational; no private notes to artists)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  subject_user_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  summary text not null,
  visibility text not null default 'staff' check (visibility in ('staff', 'subject', 'public')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_subject_idx on public.activity_events (subject_user_id, created_at desc);
create index if not exists activity_events_entity_idx on public.activity_events (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Admin settings (allowlists only; no secrets)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint admin_settings_no_secrets check (
    key not ilike '%secret%'
    and key not ilike '%password%'
    and key not ilike '%token%'
    and key not ilike '%service_role%'
    and (value::text !~* '(password|secret|token|service_role|api[_-]?key)')
  )
);

-- ---------------------------------------------------------------------------
-- Outbound email event history (architecture; do not pretend sent)
-- ---------------------------------------------------------------------------
create table if not exists public.email_outbound_events (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.email_event_status not null default 'queued',
  provider text,
  provider_message_id text,
  error text,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_outbound_events_status_idx on public.email_outbound_events (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Report exports (authz + audit)
-- ---------------------------------------------------------------------------
create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles (id) on delete cascade,
  report_type text not null,
  params jsonb not null default '{}'::jsonb,
  storage_bucket text,
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Storage buckets (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('compliance-evidence', 'compliance-evidence', false, 52428800, array['application/pdf','image/jpeg','image/png','image/webp','audio/mpeg','audio/wav','text/plain']::text[]),
  ('support-attachments', 'support-attachments', false, 26214400, array['application/pdf','image/jpeg','image/png','image/webp','text/plain']::text[])
on conflict (id) do nothing;

-- Staff can manage compliance/support objects
drop policy if exists "compliance_evidence_staff" on storage.objects;
create policy "compliance_evidence_staff" on storage.objects
  for all to authenticated
  using (bucket_id = 'compliance-evidence' and public.is_staff(auth.uid()))
  with check (bucket_id = 'compliance-evidence' and public.is_staff(auth.uid()));

drop policy if exists "support_attachments_staff" on storage.objects;
create policy "support_attachments_staff" on storage.objects
  for all to authenticated
  using (bucket_id = 'support-attachments' and public.is_staff(auth.uid()))
  with check (bucket_id = 'support-attachments' and public.is_staff(auth.uid()));

-- Requesters can read own ticket attachments via path prefix {userId}/...
drop policy if exists "support_attachments_owner_read" on storage.objects;
create policy "support_attachments_owner_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.qc_queue_items enable row level security;
alter table public.qc_reviews enable row level security;
alter table public.account_actions enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.royalty_statements enable row level security;
alter table public.royalty_line_items enable row level security;
alter table public.payouts enable row level security;
alter table public.payout_adjustments enable row level security;
alter table public.compliance_cases enable row level security;
alter table public.compliance_evidence enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;
alter table public.contact_messages enable row level security;
alter table public.activity_events enable row level security;
alter table public.admin_settings enable row level security;
alter table public.email_outbound_events enable row level security;
alter table public.report_exports enable row level security;

-- Helper: admin portal staff (admin, super_admin, support)
create or replace function public.is_admin_portal_staff(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(uid, 'admin')
      or public.has_role(uid, 'super_admin')
      or public.has_role(uid, 'support');
$$;

-- QC
drop policy if exists "qc_queue_staff" on public.qc_queue_items;
create policy "qc_queue_staff" on public.qc_queue_items
  for all to authenticated
  using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "qc_reviews_staff_select" on public.qc_reviews;
create policy "qc_reviews_staff_select" on public.qc_reviews
  for select to authenticated
  using (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "qc_reviews_no_direct_write" on public.qc_reviews;
create policy "qc_reviews_no_direct_write" on public.qc_reviews
  for insert to authenticated
  with check (false);

-- Account actions: staff read; writes via RPC
drop policy if exists "account_actions_staff" on public.account_actions;
create policy "account_actions_staff" on public.account_actions
  for select to authenticated
  using (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "account_actions_subject" on public.account_actions;
create policy "account_actions_subject" on public.account_actions
  for select to authenticated
  using (target_user_id = auth.uid() and artist_visible = true);

-- Finance: owners read own; staff read all; no client insert/update/delete on ledger
drop policy if exists "ledger_accounts_select" on public.ledger_accounts;
create policy "ledger_accounts_select" on public.ledger_accounts
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists "ledger_entries_select" on public.ledger_entries;
create policy "ledger_entries_select" on public.ledger_entries
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists "royalty_statements_select" on public.royalty_statements;
create policy "royalty_statements_select" on public.royalty_statements
  for select to authenticated
  using (
    (owner_user_id = auth.uid() and status = 'published')
    or public.is_admin_portal_staff(auth.uid())
  );

drop policy if exists "royalty_line_items_select" on public.royalty_line_items;
create policy "royalty_line_items_select" on public.royalty_line_items
  for select to authenticated
  using (
    exists (
      select 1 from public.royalty_statements s
      where s.id = statement_id
        and (
          (s.owner_user_id = auth.uid() and s.status = 'published')
          or public.is_admin_portal_staff(auth.uid())
        )
    )
  );

drop policy if exists "payouts_select" on public.payouts;
create policy "payouts_select" on public.payouts
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists "payouts_staff_insert" on public.payouts;
create policy "payouts_staff_insert" on public.payouts
  for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin')
  );

drop policy if exists "payouts_staff_update" on public.payouts;
create policy "payouts_staff_update" on public.payouts
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "payout_adjustments_select" on public.payout_adjustments;
create policy "payout_adjustments_select" on public.payout_adjustments
  for select to authenticated
  using (
    public.is_admin_portal_staff(auth.uid())
    or exists (select 1 from public.payouts p where p.id = payout_id and p.owner_user_id = auth.uid())
  );

drop policy if exists "payout_adjustments_staff_insert" on public.payout_adjustments;
create policy "payout_adjustments_staff_insert" on public.payout_adjustments
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

-- Compliance staff-only
drop policy if exists "compliance_cases_staff" on public.compliance_cases;
create policy "compliance_cases_staff" on public.compliance_cases
  for all to authenticated
  using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "compliance_evidence_staff" on public.compliance_evidence;
create policy "compliance_evidence_staff" on public.compliance_evidence
  for all to authenticated
  using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

-- Support
drop policy if exists "support_tickets_select" on public.support_tickets;
create policy "support_tickets_select" on public.support_tickets
  for select to authenticated
  using (requester_user_id = auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists "support_tickets_insert" on public.support_tickets;
create policy "support_tickets_insert" on public.support_tickets
  for insert to authenticated
  with check (requester_user_id = auth.uid());

drop policy if exists "support_tickets_update" on public.support_tickets;
create policy "support_tickets_update" on public.support_tickets
  for update to authenticated
  using (public.is_admin_portal_staff(auth.uid()) or requester_user_id = auth.uid())
  with check (public.is_admin_portal_staff(auth.uid()) or requester_user_id = auth.uid());

drop policy if exists "support_messages_select" on public.support_messages;
create policy "support_messages_select" on public.support_messages
  for select to authenticated
  using (
    public.is_admin_portal_staff(auth.uid())
    or (
      is_internal = false
      and exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.requester_user_id = auth.uid()
      )
    )
  );

drop policy if exists "support_messages_insert" on public.support_messages;
create policy "support_messages_insert" on public.support_messages
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and (
      public.is_admin_portal_staff(auth.uid())
      or (
        is_internal = false
        and exists (
          select 1 from public.support_tickets t
          where t.id = ticket_id and t.requester_user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "support_attachments_select" on public.support_attachments;
create policy "support_attachments_select" on public.support_attachments
  for select to authenticated
  using (
    public.is_admin_portal_staff(auth.uid())
    or exists (
      select 1 from public.support_messages m
      join public.support_tickets t on t.id = m.ticket_id
      where m.id = message_id and t.requester_user_id = auth.uid() and m.is_internal = false
    )
  );

drop policy if exists "support_attachments_insert" on public.support_attachments;
create policy "support_attachments_insert" on public.support_attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid());

-- Contact: staff only
drop policy if exists "contact_messages_staff" on public.contact_messages;
create policy "contact_messages_staff" on public.contact_messages
  for all to authenticated
  using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

-- Activity
drop policy if exists "activity_events_staff" on public.activity_events;
create policy "activity_events_staff" on public.activity_events
  for select to authenticated
  using (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "activity_events_subject" on public.activity_events;
create policy "activity_events_subject" on public.activity_events
  for select to authenticated
  using (subject_user_id = auth.uid() and visibility in ('subject', 'public'));

drop policy if exists "activity_events_staff_insert" on public.activity_events;
create policy "activity_events_staff_insert" on public.activity_events
  for insert to authenticated
  with check (public.is_admin_portal_staff(auth.uid()));

-- Settings: admin+
drop policy if exists "admin_settings_select" on public.admin_settings;
create policy "admin_settings_select" on public.admin_settings
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "admin_settings_write" on public.admin_settings;
create policy "admin_settings_write" on public.admin_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

-- Email events: staff read
drop policy if exists "email_events_staff" on public.email_outbound_events;
create policy "email_events_staff" on public.email_outbound_events
  for select to authenticated
  using (public.is_admin_portal_staff(auth.uid()));

-- Report exports
drop policy if exists "report_exports_own_or_admin" on public.report_exports;
create policy "report_exports_own_or_admin" on public.report_exports
  for select to authenticated
  using (requested_by = auth.uid() or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "report_exports_insert" on public.report_exports;
create policy "report_exports_insert" on public.report_exports
  for insert to authenticated
  with check (
    requested_by = auth.uid()
    and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'super_admin'))
  );

-- Staff can read all releases (already via is_staff in batch4) — ensure support covered
-- Backfill QC queue for existing submitted/in_qc releases
insert into public.qc_queue_items (release_id, status)
select id, case when status = 'in_qc' then 'in_review' else 'queued' end
from public.releases
where status in ('submitted', 'in_qc')
on conflict (release_id) do nothing;

comment on table public.payouts is 'Payouts use integer minor units. PAID requires real payment_reference — never forge.';
comment on table public.email_outbound_events is 'Outbound email architecture only; status sent must come from a real provider.';
