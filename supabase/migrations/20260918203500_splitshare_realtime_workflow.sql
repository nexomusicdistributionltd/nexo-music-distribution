-- SplitShare production workflow for artist/label accounts and admin review.
-- Provider truth: Too Lost has no documented public API endpoints for royalty
-- split/payee/recoupment mutation, so Nexo's immutable royalty ledger is the
-- authoritative SplitShare engine. Only posted royalty rows can create money.

-- ---------------------------------------------------------------------------
-- Payees: review state + account linking
-- ---------------------------------------------------------------------------
alter table public.portal_payees
  add column if not exists status text,
  add column if not exists admin_note text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists linked_user_id uuid references public.profiles(id) on delete set null;

update public.portal_payees
set status = coalesce(status, 'approved')
where status is null;

alter table public.portal_payees
  alter column status set default 'submitted',
  alter column status set not null;

do $$ begin
  alter table public.portal_payees
    add constraint portal_payees_status_check
    check (status in ('submitted','approved','rejected','disabled'));
exception when duplicate_object then null;
end $$;

create unique index if not exists portal_payees_owner_email_uidx
  on public.portal_payees(owner_user_id, lower(email))
  where email is not null and btrim(email) <> '';

create index if not exists portal_payees_status_idx
  on public.portal_payees(status, created_at desc);

-- ---------------------------------------------------------------------------
-- Split rules: review state. New artist/label rules stay inactive until review.
-- ---------------------------------------------------------------------------
alter table public.royalty_split_rules
  add column if not exists review_status text,
  add column if not exists admin_note text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

update public.royalty_split_rules
set review_status = coalesce(review_status, 'approved')
where review_status is null;

alter table public.royalty_split_rules
  alter column review_status set default 'submitted',
  alter column review_status set not null;

do $$ begin
  alter table public.royalty_split_rules
    add constraint royalty_split_rules_review_status_check
    check (review_status in ('submitted','approved','rejected'));
exception when duplicate_object then null;
end $$;

alter table public.royalty_split_shares
  add column if not exists payee_id uuid references public.portal_payees(id) on delete set null;

create index if not exists royalty_split_shares_payee_idx
  on public.royalty_split_shares(payee_id)
  where payee_id is not null;

-- ---------------------------------------------------------------------------
-- Track assignment review
-- ---------------------------------------------------------------------------
alter table public.split_track_assignments
  add column if not exists status text,
  add column if not exists admin_note text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.split_track_assignments
set status = coalesce(status, 'approved')
where status is null;

alter table public.split_track_assignments
  alter column status set default 'submitted',
  alter column status set not null;

do $$ begin
  alter table public.split_track_assignments
    add constraint split_track_assignments_status_check
    check (status in ('submitted','approved','rejected'));
exception when duplicate_object then null;
end $$;

drop trigger if exists split_track_assignments_set_updated_at on public.split_track_assignments;
create trigger split_track_assignments_set_updated_at
  before update on public.split_track_assignments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Recoupments: tie a real balance to a payee and optional track
-- ---------------------------------------------------------------------------
alter table public.portal_recoupments
  drop constraint if exists portal_recoupments_status_check;

alter table public.portal_recoupments
  add column if not exists payee_id uuid references public.portal_payees(id) on delete restrict,
  add column if not exists track_id uuid references public.release_tracks(id) on delete set null,
  add column if not exists recovered_minor bigint not null default 0,
  add column if not exists admin_note text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

update public.portal_recoupments
set status = case when status = 'closed' then 'closed' else 'approved' end
where status in ('open','closed');

alter table public.portal_recoupments
  alter column status set default 'submitted';

do $$ begin
  alter table public.portal_recoupments
    add constraint portal_recoupments_status_check
    check (status in ('submitted','reviewing','approved','rejected','closed'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.portal_recoupments
    add constraint portal_recoupments_recovered_check
    check (recovered_minor >= 0 and recovered_minor <= amount_minor);
exception when duplicate_object then null;
end $$;

create index if not exists portal_recoupments_payee_idx
  on public.portal_recoupments(payee_id, currency, status, created_at);

-- ---------------------------------------------------------------------------
-- Immutable allocation audit: only database triggers write this table.
-- ---------------------------------------------------------------------------
create table if not exists public.splitshare_allocations (
  id uuid primary key default gen_random_uuid(),
  import_row_id uuid not null references public.royalty_import_rows(id) on delete restrict,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  track_id uuid references public.release_tracks(id) on delete set null,
  split_rule_id uuid not null references public.royalty_split_rules(id) on delete restrict,
  split_share_id uuid not null references public.royalty_split_shares(id) on delete restrict,
  payee_id uuid references public.portal_payees(id) on delete set null,
  beneficiary_user_id uuid references public.profiles(id) on delete set null,
  currency char(3) not null,
  gross_share_minor bigint not null,
  recouped_minor bigint not null default 0 check (recouped_minor >= 0),
  payable_minor bigint not null,
  status text not null check (status in ('owner','credited','held','recouped')),
  owner_transfer_ledger_entry_id uuid references public.ledger_entries(id) on delete set null,
  beneficiary_transfer_ledger_entry_id uuid references public.ledger_entries(id) on delete set null,
  held_ledger_entry_id uuid references public.ledger_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(import_row_id, split_share_id),
  constraint splitshare_allocation_math check (
    (gross_share_minor >= 0 and payable_minor >= 0 and gross_share_minor = recouped_minor + payable_minor)
    or
    (gross_share_minor < 0 and recouped_minor = 0 and payable_minor = gross_share_minor)
  )
);

create index if not exists splitshare_allocations_owner_idx
  on public.splitshare_allocations(owner_user_id, created_at desc);
create index if not exists splitshare_allocations_payee_idx
  on public.splitshare_allocations(payee_id, currency, status)
  where payee_id is not null;
create index if not exists splitshare_allocations_beneficiary_idx
  on public.splitshare_allocations(beneficiary_user_id, created_at desc)
  where beneficiary_user_id is not null;

alter table public.splitshare_allocations enable row level security;

revoke all on table public.splitshare_allocations from anon, authenticated;
grant select on table public.splitshare_allocations to authenticated;

drop policy if exists "splitshare_allocations_select" on public.splitshare_allocations;
create policy "splitshare_allocations_select"
  on public.splitshare_allocations
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or beneficiary_user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- Harden existing SplitShare RLS so clients cannot self-approve.
-- ---------------------------------------------------------------------------
grant select, insert, update on table public.portal_payees to authenticated;
grant select, insert, update on table public.royalty_split_rules to authenticated;
grant select, insert, update, delete on table public.royalty_split_shares to authenticated;
grant select, insert, update on table public.split_track_assignments to authenticated;
grant select, insert, update on table public.portal_recoupments to authenticated;

drop policy if exists "portal_payees_select" on public.portal_payees;
drop policy if exists "portal_payees_write" on public.portal_payees;
drop policy if exists "portal_payees_owner_insert" on public.portal_payees;
drop policy if exists "portal_payees_admin_write" on public.portal_payees;

create policy "portal_payees_select"
  on public.portal_payees
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "portal_payees_owner_insert"
  on public.portal_payees
  for insert
  to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and status = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
    and linked_user_id is null
  );

create policy "portal_payees_admin_write"
  on public.portal_payees
  for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  )
  with check (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

drop policy if exists "royalty_split_rules_select" on public.royalty_split_rules;
drop policy if exists "royalty_split_rules_owner_write" on public.royalty_split_rules;
drop policy if exists "royalty_split_rules_owner_update" on public.royalty_split_rules;
drop policy if exists "royalty_split_rules_owner_insert" on public.royalty_split_rules;
drop policy if exists "royalty_split_rules_admin_write" on public.royalty_split_rules;

create policy "royalty_split_rules_select"
  on public.royalty_split_rules
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "royalty_split_rules_owner_insert"
  on public.royalty_split_rules
  for insert
  to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and review_status = 'submitted'
    and is_active = false
    and reviewed_by is null
    and reviewed_at is null
  );

create policy "royalty_split_rules_admin_write"
  on public.royalty_split_rules
  for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  )
  with check (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

drop policy if exists "royalty_split_shares_select" on public.royalty_split_shares;
drop policy if exists "royalty_split_shares_write" on public.royalty_split_shares;
drop policy if exists "royalty_split_shares_owner_insert" on public.royalty_split_shares;
drop policy if exists "royalty_split_shares_admin_write" on public.royalty_split_shares;

create policy "royalty_split_shares_select"
  on public.royalty_split_shares
  for select
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
    or party_user_id = (select auth.uid())
    or exists (
      select 1
      from public.royalty_split_rules r
      where r.id = royalty_split_shares.rule_id
        and r.owner_user_id = (select auth.uid())
    )
  );

create policy "royalty_split_shares_owner_insert"
  on public.royalty_split_shares
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.royalty_split_rules r
      where r.id = royalty_split_shares.rule_id
        and r.owner_user_id = (select auth.uid())
        and r.review_status = 'submitted'
        and r.is_active = false
    )
    and payee_id is not null
    and exists (
      select 1
      from public.portal_payees p
      where p.id = royalty_split_shares.payee_id
        and p.owner_user_id = (select auth.uid())
        and p.status = 'approved'
    )
  );

create policy "royalty_split_shares_admin_write"
  on public.royalty_split_shares
  for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  )
  with check (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

drop policy if exists "split_assign_select" on public.split_track_assignments;
drop policy if exists "split_assign_write" on public.split_track_assignments;
drop policy if exists "split_assign_owner_insert" on public.split_track_assignments;
drop policy if exists "split_assign_owner_update" on public.split_track_assignments;
drop policy if exists "split_assign_admin_write" on public.split_track_assignments;

create policy "split_assign_select"
  on public.split_track_assignments
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "split_assign_owner_insert"
  on public.split_track_assignments
  for insert
  to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and status = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1
      from public.release_tracks t
      join public.releases r on r.id = t.release_id
      where t.id = split_track_assignments.track_id
        and r.owner_user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.royalty_split_rules sr
      where sr.id = split_track_assignments.split_rule_id
        and sr.owner_user_id = (select auth.uid())
        and sr.review_status = 'approved'
        and sr.is_active = true
    )
  );

create policy "split_assign_owner_update"
  on public.split_track_assignments
  for update
  to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (
    owner_user_id = (select auth.uid())
    and status = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1
      from public.release_tracks t
      join public.releases r on r.id = t.release_id
      where t.id = split_track_assignments.track_id
        and r.owner_user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.royalty_split_rules sr
      where sr.id = split_track_assignments.split_rule_id
        and sr.owner_user_id = (select auth.uid())
        and sr.review_status = 'approved'
        and sr.is_active = true
    )
  );

create policy "split_assign_admin_write"
  on public.split_track_assignments
  for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  )
  with check (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

drop policy if exists "portal_recoup_select" on public.portal_recoupments;
drop policy if exists "portal_recoup_write" on public.portal_recoupments;
drop policy if exists "portal_recoup_owner_insert" on public.portal_recoupments;
drop policy if exists "portal_recoup_admin_write" on public.portal_recoupments;

create policy "portal_recoup_select"
  on public.portal_recoupments
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "portal_recoup_owner_insert"
  on public.portal_recoupments
  for insert
  to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and status = 'submitted'
    and recovered_minor = 0
    and reviewed_by is null
    and reviewed_at is null
    and payee_id is not null
    and exists (
      select 1
      from public.portal_payees p
      where p.id = portal_recoupments.payee_id
        and p.owner_user_id = (select auth.uid())
        and p.status = 'approved'
    )
    and (
      track_id is null
      or exists (
        select 1
        from public.release_tracks t
        join public.releases r on r.id = t.release_id
        where t.id = portal_recoupments.track_id
          and r.owner_user_id = (select auth.uid())
      )
    )
  );

create policy "portal_recoup_admin_write"
  on public.portal_recoupments
  for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  )
  with check (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- Atomic split submission. SECURITY INVOKER keeps RLS active.
-- ---------------------------------------------------------------------------
create or replace function public.submit_splitshare_rule(
  p_name text,
  p_effective_from date,
  p_shares jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  rule_id uuid;
  item jsonb;
  payee public.portal_payees;
  payee_id_value uuid;
  share_bps_value integer;
  total_bps integer := 0;
  clean_name text := btrim(coalesce(p_name, ''));
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not (public.has_role(actor, 'artist') or public.has_role(actor, 'label')) then
    raise exception 'Artist or label account required' using errcode = '42501';
  end if;
  if length(clean_name) < 1 or length(clean_name) > 200 then
    raise exception 'Split name is required' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) < 1 then
    raise exception 'At least one payee share is required' using errcode = 'P0001';
  end if;

  for item in select value from jsonb_array_elements(p_shares)
  loop
    payee_id_value := nullif(item->>'payee_id','')::uuid;
    share_bps_value := coalesce((item->>'share_bps')::integer, 0);

    if share_bps_value <= 0 or share_bps_value > 10000 then
      raise exception 'Invalid share percentage' using errcode = 'P0001';
    end if;

    select * into payee
    from public.portal_payees
    where id = payee_id_value
      and owner_user_id = actor
      and status = 'approved';

    if not found then
      raise exception 'Every split share must use an approved payee' using errcode = 'P0001';
    end if;

    total_bps := total_bps + share_bps_value;
  end loop;

  if total_bps <> 10000 then
    raise exception 'Split shares must total exactly 100%%' using errcode = 'P0001';
  end if;

  insert into public.royalty_split_rules (
    owner_user_id, name, scope_type, effective_from, is_active,
    review_status, created_by
  ) values (
    actor, clean_name, 'account', coalesce(p_effective_from, current_date), false,
    'submitted', actor
  )
  returning id into rule_id;

  for item in select value from jsonb_array_elements(p_shares)
  loop
    payee_id_value := (item->>'payee_id')::uuid;
    share_bps_value := (item->>'share_bps')::integer;

    select * into payee
    from public.portal_payees
    where id = payee_id_value
      and owner_user_id = actor
      and status = 'approved';

    insert into public.royalty_split_shares (
      rule_id, payee_id, party_user_id, party_name, party_role, share_bps
    ) values (
      rule_id,
      payee.id,
      payee.linked_user_id,
      payee.name,
      case
        when payee.role_label in ('artist','label','producer','songwriter','featured','publisher','other')
          then payee.role_label::public.split_party_role
        else 'other'::public.split_party_role
      end,
      share_bps_value
    );
  end loop;

  return rule_id;
end;
$$;

revoke all on function public.submit_splitshare_rule(text,date,jsonb) from public;
revoke all on function public.submit_splitshare_rule(text,date,jsonb) from anon;
grant execute on function public.submit_splitshare_rule(text,date,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Internal trigger functions live outside exposed schemas.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.link_splitshare_payees_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;

  update public.portal_payees
  set linked_user_id = new.id
  where status = 'approved'
    and linked_user_id is null
    and lower(email) = lower(new.email);

  return new;
end;
$$;

revoke execute on function private.link_splitshare_payees_for_profile() from public, anon, authenticated;

drop trigger if exists profiles_link_splitshare_payees on public.profiles;
create trigger profiles_link_splitshare_payees
  after insert or update of email on public.profiles
  for each row execute function private.link_splitshare_payees_for_profile();

-- ---------------------------------------------------------------------------
-- Apply approved SplitShare to real posted royalty credits.
-- The source royalty credit is posted first. We then append transfers:
--   linked payee   -> owner available debit + beneficiary available credit
--   external payee -> owner available debit + owner held credit
-- Recouped value remains with the owner and reduces the payee payable.
-- ---------------------------------------------------------------------------
create or replace function private.apply_splitshare_on_royalty_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  applied_rule_id uuid;
  total_bps integer;
  floor_total bigint;
  remainder bigint;
  source_abs bigint;
  direction integer;
  first_share boolean := true;
  share_row public.royalty_split_shares;
  rec public.portal_recoupments;
  gross_share_abs bigint;
  gross_share bigint;
  recouped bigint;
  recoup_take bigint;
  payable bigint;
  beneficiary uuid;
  linked_beneficiary uuid;
  payee_status text;
  beneficiary_account uuid;
  allocation_id uuid;
  owner_transfer_id uuid;
  beneficiary_transfer_id uuid;
  held_transfer_id uuid;
  effective_date date;
begin
  if new.kind not in ('royalty_credit', 'royalty_debit')
     or new.amount_minor = 0
     or new.import_row_id is null
     or new.track_id is null
     or new.split_rule_id is not null then
    return new;
  end if;

  effective_date := coalesce(new.period_end, new.created_at::date);
  source_abs := abs(new.amount_minor);
  direction := case when new.amount_minor > 0 then 1 else -1 end;

  select assignment.split_rule_id
  into applied_rule_id
  from public.split_track_assignments assignment
  join public.royalty_split_rules rule on rule.id = assignment.split_rule_id
  where assignment.owner_user_id = new.owner_user_id
    and assignment.track_id = new.track_id
    and assignment.status = 'approved'
    and rule.owner_user_id = new.owner_user_id
    and rule.review_status = 'approved'
    and rule.is_active = true
    and rule.effective_from <= effective_date
    and (rule.effective_to is null or rule.effective_to >= effective_date)
  limit 1;

  if applied_rule_id is null then
    return new;
  end if;

  -- Legacy name-only rules are intentionally not posted through the automated
  -- engine. Every automated share must point at an approved Nexo payee.
  if exists (
    select 1
    from public.royalty_split_shares
    where rule_id = applied_rule_id
      and payee_id is null
  ) then
    return new;
  end if;

  select coalesce(sum(share_bps), 0)
  into total_bps
  from public.royalty_split_shares
  where rule_id = applied_rule_id;

  if total_bps <> 10000 then
    return new;
  end if;

  select coalesce(sum(floor((source_abs::numeric * share_bps::numeric) / 10000)::bigint), 0)
  into floor_total
  from public.royalty_split_shares
  where rule_id = applied_rule_id;

  remainder := source_abs - floor_total;

  for share_row in
    select *
    from public.royalty_split_shares
    where rule_id = applied_rule_id
    order by id
  loop
    gross_share_abs := floor((source_abs::numeric * share_row.share_bps::numeric) / 10000)::bigint;
    if first_share then
      gross_share_abs := gross_share_abs + remainder;
      first_share := false;
    end if;
    gross_share := gross_share_abs * direction;

    linked_beneficiary := null;
    payee_status := null;

    select p.linked_user_id, p.status
    into linked_beneficiary, payee_status
    from public.portal_payees p
    where p.id = share_row.payee_id;

    beneficiary := case
      when payee_status = 'approved' then coalesce(linked_beneficiary, share_row.party_user_id)
      else null
    end;

    recouped := 0;
    payable := gross_share;

    -- Recoupments consume positive earnings only. A negative provider row is
    -- a chargeback/adjustment and is allocated proportionally without
    -- advancing the recoupment balance.
    if direction > 0
       and share_row.payee_id is not null
       and beneficiary is distinct from new.owner_user_id
       and payable > 0 then
      for rec in
        select *
        from public.portal_recoupments
        where owner_user_id = new.owner_user_id
          and payee_id = share_row.payee_id
          and status = 'approved'
          and currency = new.currency
          and amount_minor > recovered_minor
          and (track_id is null or track_id = new.track_id)
        order by created_at, id
        for update
      loop
        recoup_take := least(payable, rec.amount_minor - rec.recovered_minor);
        if recoup_take <= 0 then
          continue;
        end if;

        update public.portal_recoupments
        set
          recovered_minor = recovered_minor + recoup_take,
          status = case
            when recovered_minor + recoup_take >= amount_minor then 'closed'
            else status
          end
        where id = rec.id;

        recouped := recouped + recoup_take;
        payable := payable - recoup_take;
        exit when payable <= 0;
      end loop;
    end if;

    insert into public.splitshare_allocations (
      import_row_id,
      owner_user_id,
      track_id,
      split_rule_id,
      split_share_id,
      payee_id,
      beneficiary_user_id,
      currency,
      gross_share_minor,
      recouped_minor,
      payable_minor,
      status
    ) values (
      new.import_row_id,
      new.owner_user_id,
      new.track_id,
      applied_rule_id,
      share_row.id,
      share_row.payee_id,
      beneficiary,
      new.currency,
      gross_share,
      recouped,
      payable,
      case
        when payable = 0 then 'recouped'
        when beneficiary = new.owner_user_id then 'owner'
        when beneficiary is not null then 'credited'
        else 'held'
      end
    )
    on conflict (import_row_id, split_share_id) do nothing
    returning id into allocation_id;

    if allocation_id is null or payable = 0 or beneficiary = new.owner_user_id then
      continue;
    end if;

    insert into public.ledger_entries (
      account_id, owner_user_id, kind, amount_minor, currency, description,
      reference_type, reference_id, created_by, gross_minor, net_minor,
      share_bps, deduction_minor, period_start, period_end, release_id,
      track_id, isrc, upc, territory, dsp_code, balance_bucket, import_row_id,
      split_rule_id, metadata
    ) values (
      new.account_id,
      new.owner_user_id,
      case
        when payable > 0 then 'royalty_debit'::public.money_entry_kind
        else 'royalty_credit'::public.money_entry_kind
      end,
      -payable,
      new.currency,
      case
        when payable > 0 then 'SplitShare allocation to ' || share_row.party_name
        else 'SplitShare negative adjustment allocated to ' || share_row.party_name
      end,
      'splitshare_allocation',
      allocation_id,
      new.created_by,
      -gross_share,
      -payable,
      share_row.share_bps,
      recouped,
      new.period_start,
      new.period_end,
      new.release_id,
      new.track_id,
      new.isrc,
      new.upc,
      new.territory,
      new.dsp_code,
      'available',
      new.import_row_id,
      applied_rule_id,
      jsonb_build_object(
        'splitshare_allocation_id', allocation_id,
        'payee_id', share_row.payee_id,
        'recouped_minor', recouped,
        'source_direction', direction
      )
    )
    returning id into owner_transfer_id;

    if beneficiary is not null then
      insert into public.ledger_accounts(owner_user_id, currency, label)
      values (beneficiary, new.currency, 'default')
      on conflict (owner_user_id, currency, label) do nothing;

      select id into beneficiary_account
      from public.ledger_accounts
      where owner_user_id = beneficiary
        and currency = new.currency
        and label = 'default';

      insert into public.ledger_entries (
        account_id, owner_user_id, kind, amount_minor, currency, description,
        reference_type, reference_id, created_by, gross_minor, net_minor,
        share_bps, deduction_minor, period_start, period_end, release_id,
        track_id, isrc, upc, territory, dsp_code, balance_bucket, import_row_id,
        split_rule_id, metadata
      ) values (
        beneficiary_account,
        beneficiary,
        case
          when payable > 0 then 'royalty_credit'::public.money_entry_kind
          else 'royalty_debit'::public.money_entry_kind
        end,
        payable,
        new.currency,
        case
          when payable > 0 then 'SplitShare credit from ' || share_row.party_name
          else 'SplitShare negative royalty adjustment'
        end,
        'splitshare_allocation',
        allocation_id,
        new.created_by,
        gross_share,
        payable,
        share_row.share_bps,
        recouped,
        new.period_start,
        new.period_end,
        new.release_id,
        new.track_id,
        new.isrc,
        new.upc,
        new.territory,
        new.dsp_code,
        'available',
        new.import_row_id,
        applied_rule_id,
        jsonb_build_object(
          'splitshare_allocation_id', allocation_id,
          'source_owner_user_id', new.owner_user_id,
          'payee_id', share_row.payee_id,
          'source_direction', direction
        )
      )
      returning id into beneficiary_transfer_id;
    else
      insert into public.ledger_entries (
        account_id, owner_user_id, kind, amount_minor, currency, description,
        reference_type, reference_id, created_by, gross_minor, net_minor,
        share_bps, deduction_minor, period_start, period_end, release_id,
        track_id, isrc, upc, territory, dsp_code, balance_bucket, import_row_id,
        split_rule_id, metadata
      ) values (
        new.account_id,
        new.owner_user_id,
        case
          when payable > 0 then 'royalty_credit'::public.money_entry_kind
          else 'royalty_debit'::public.money_entry_kind
        end,
        payable,
        new.currency,
        case
          when payable > 0 then 'SplitShare held for external payee ' || share_row.party_name
          else 'SplitShare held negative adjustment for external payee ' || share_row.party_name
        end,
        'splitshare_allocation',
        allocation_id,
        new.created_by,
        gross_share,
        payable,
        share_row.share_bps,
        recouped,
        new.period_start,
        new.period_end,
        new.release_id,
        new.track_id,
        new.isrc,
        new.upc,
        new.territory,
        new.dsp_code,
        'held',
        new.import_row_id,
        applied_rule_id,
        jsonb_build_object(
          'splitshare_allocation_id', allocation_id,
          'payee_id', share_row.payee_id,
          'external_payee', true,
          'source_direction', direction
        )
      )
      returning id into held_transfer_id;
    end if;

    update public.splitshare_allocations
    set
      owner_transfer_ledger_entry_id = owner_transfer_id,
      beneficiary_transfer_ledger_entry_id = beneficiary_transfer_id,
      held_ledger_entry_id = held_transfer_id
    where id = allocation_id;
  end loop;

  return new;
end;
$$;

revoke execute on function private.apply_splitshare_on_royalty_credit() from public, anon, authenticated;

drop trigger if exists ledger_entries_apply_splitshare on public.ledger_entries;
create trigger ledger_entries_apply_splitshare
  after insert on public.ledger_entries
  for each row execute function private.apply_splitshare_on_royalty_credit();

-- ---------------------------------------------------------------------------
-- If an external payee later links to a Nexo account, release prior held money.
-- ---------------------------------------------------------------------------
create or replace function private.release_splitshare_held_allocations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allocation public.splitshare_allocations;
  owner_account uuid;
  beneficiary_account uuid;
  beneficiary_transfer_id uuid;
begin
  if new.linked_user_id is null
     or new.status <> 'approved'
     or new.linked_user_id is not distinct from old.linked_user_id then
    return new;
  end if;

  for allocation in
    select *
    from public.splitshare_allocations
    where payee_id = new.id
      and status = 'held'
      and payable_minor <> 0
    order by created_at, id
    for update
  loop
    select id into owner_account
    from public.ledger_accounts
    where owner_user_id = allocation.owner_user_id
      and currency = allocation.currency
      and label = 'default';

    if owner_account is null then
      insert into public.ledger_accounts(owner_user_id, currency, label)
      values (allocation.owner_user_id, allocation.currency, 'default')
      on conflict (owner_user_id, currency, label) do nothing;

      select id into owner_account
      from public.ledger_accounts
      where owner_user_id = allocation.owner_user_id
        and currency = allocation.currency
        and label = 'default';
    end if;

    insert into public.ledger_accounts(owner_user_id, currency, label)
    values (new.linked_user_id, allocation.currency, 'default')
    on conflict (owner_user_id, currency, label) do nothing;

    select id into beneficiary_account
    from public.ledger_accounts
    where owner_user_id = new.linked_user_id
      and currency = allocation.currency
      and label = 'default';

    -- Remove the signed balance from the owner's held bucket.
    insert into public.ledger_entries (
      account_id, owner_user_id, kind, amount_minor, currency, description,
      reference_type, reference_id, created_by, balance_bucket, split_rule_id,
      track_id, metadata
    ) values (
      owner_account,
      allocation.owner_user_id,
      case
        when allocation.payable_minor > 0 then 'royalty_debit'::public.money_entry_kind
        else 'royalty_credit'::public.money_entry_kind
      end,
      -allocation.payable_minor,
      allocation.currency,
      'Release held SplitShare balance to linked payee',
      'splitshare_allocation',
      allocation.id,
      auth.uid(),
      'held',
      allocation.split_rule_id,
      allocation.track_id,
      jsonb_build_object('payee_id', new.id, 'release_held', true)
    );

    -- Apply the same signed balance to the linked beneficiary's available bucket.
    insert into public.ledger_entries (
      account_id, owner_user_id, kind, amount_minor, currency, description,
      reference_type, reference_id, created_by, balance_bucket, split_rule_id,
      track_id, metadata
    ) values (
      beneficiary_account,
      new.linked_user_id,
      case
        when allocation.payable_minor > 0 then 'royalty_credit'::public.money_entry_kind
        else 'royalty_debit'::public.money_entry_kind
      end,
      allocation.payable_minor,
      allocation.currency,
      case
        when allocation.payable_minor > 0 then 'Released SplitShare payable'
        else 'Released SplitShare negative adjustment'
      end,
      'splitshare_allocation',
      allocation.id,
      auth.uid(),
      'available',
      allocation.split_rule_id,
      allocation.track_id,
      jsonb_build_object(
        'payee_id', new.id,
        'released_from_owner_user_id', allocation.owner_user_id
      )
    )
    returning id into beneficiary_transfer_id;

    update public.splitshare_allocations
    set
      beneficiary_user_id = new.linked_user_id,
      status = 'credited',
      beneficiary_transfer_ledger_entry_id = beneficiary_transfer_id
    where id = allocation.id;
  end loop;

  return new;
end;
$$;

revoke execute on function private.release_splitshare_held_allocations() from public, anon, authenticated;

drop trigger if exists portal_payees_release_held_splitshare on public.portal_payees;
create trigger portal_payees_release_held_splitshare
  after update of linked_user_id, status on public.portal_payees
  for each row execute function private.release_splitshare_held_allocations();

-- ---------------------------------------------------------------------------
-- Realtime publication. Postgres Changes still requires table publication.
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.royalty_split_rules;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.royalty_split_shares;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.portal_payees;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.split_track_assignments;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.portal_recoupments;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.splitshare_allocations;
  exception when duplicate_object then null;
  end;
end $$;

comment on table public.splitshare_allocations is
  'Immutable allocation audit created only from real posted royalty credits using admin-approved SplitShare track assignments.';
