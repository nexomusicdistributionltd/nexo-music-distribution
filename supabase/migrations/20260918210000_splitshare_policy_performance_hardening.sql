-- Follow-up SplitShare hardening after advisor review.
-- Consolidates overlapping permissive policies, adds safe payee resubmission,
-- and adds covering indexes for the SplitShare foreign keys used by live routes.

-- ---------------------------------------------------------------------------
-- Payees
-- ---------------------------------------------------------------------------
drop policy if exists "portal_payees_owner_insert" on public.portal_payees;
drop policy if exists "portal_payees_admin_write" on public.portal_payees;
drop policy if exists "portal_payees_insert" on public.portal_payees;
drop policy if exists "portal_payees_update" on public.portal_payees;

create policy "portal_payees_insert"
  on public.portal_payees
  for insert
  to authenticated
  with check (
    (
      owner_user_id = (select auth.uid())
      and status = 'submitted'
      and reviewed_by is null
      and reviewed_at is null
      and linked_user_id is null
    )
    or public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "portal_payees_update"
  on public.portal_payees
  for update
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
    or (
      owner_user_id = (select auth.uid())
      and status in ('rejected', 'disabled')
    )
  )
  with check (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
    or (
      owner_user_id = (select auth.uid())
      and status = 'submitted'
      and reviewed_by is null
      and reviewed_at is null
      and linked_user_id is null
    )
  );

-- ---------------------------------------------------------------------------
-- Split rules
-- ---------------------------------------------------------------------------
drop policy if exists "royalty_split_rules_owner_insert" on public.royalty_split_rules;
drop policy if exists "royalty_split_rules_admin_write" on public.royalty_split_rules;
drop policy if exists "royalty_split_rules_insert" on public.royalty_split_rules;
drop policy if exists "royalty_split_rules_update" on public.royalty_split_rules;

create policy "royalty_split_rules_insert"
  on public.royalty_split_rules
  for insert
  to authenticated
  with check (
    (
      owner_user_id = (select auth.uid())
      and review_status = 'submitted'
      and is_active = false
      and reviewed_by is null
      and reviewed_at is null
    )
    or public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "royalty_split_rules_update"
  on public.royalty_split_rules
  for update
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
-- Split shares
-- ---------------------------------------------------------------------------
drop policy if exists "royalty_split_shares_owner_insert" on public.royalty_split_shares;
drop policy if exists "royalty_split_shares_admin_write" on public.royalty_split_shares;
drop policy if exists "royalty_split_shares_insert" on public.royalty_split_shares;
drop policy if exists "royalty_split_shares_update" on public.royalty_split_shares;
drop policy if exists "royalty_split_shares_delete" on public.royalty_split_shares;

create policy "royalty_split_shares_insert"
  on public.royalty_split_shares
  for insert
  to authenticated
  with check (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
    or (
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
    )
  );

create policy "royalty_split_shares_update"
  on public.royalty_split_shares
  for update
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  )
  with check (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "royalty_split_shares_delete"
  on public.royalty_split_shares
  for delete
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- ---------------------------------------------------------------------------
-- Track assignments
-- ---------------------------------------------------------------------------
drop policy if exists "split_assign_owner_insert" on public.split_track_assignments;
drop policy if exists "split_assign_owner_update" on public.split_track_assignments;
drop policy if exists "split_assign_admin_write" on public.split_track_assignments;
drop policy if exists "split_assign_insert" on public.split_track_assignments;
drop policy if exists "split_assign_update" on public.split_track_assignments;

create policy "split_assign_insert"
  on public.split_track_assignments
  for insert
  to authenticated
  with check (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
    or (
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
    )
  );

create policy "split_assign_update"
  on public.split_track_assignments
  for update
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
    or owner_user_id = (select auth.uid())
  )
  with check (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
    or (
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
    )
  );

-- ---------------------------------------------------------------------------
-- Recoupments
-- ---------------------------------------------------------------------------
drop policy if exists "portal_recoup_owner_insert" on public.portal_recoupments;
drop policy if exists "portal_recoup_admin_write" on public.portal_recoupments;
drop policy if exists "portal_recoup_insert" on public.portal_recoupments;
drop policy if exists "portal_recoup_update" on public.portal_recoupments;

create policy "portal_recoup_insert"
  on public.portal_recoupments
  for insert
  to authenticated
  with check (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
    or (
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
    )
  );

create policy "portal_recoup_update"
  on public.portal_recoupments
  for update
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
-- Cover foreign keys used by SplitShare review, realtime, and audit routes.
-- ---------------------------------------------------------------------------
create index if not exists portal_payees_linked_user_idx
  on public.portal_payees(linked_user_id)
  where linked_user_id is not null;
create index if not exists portal_payees_reviewed_by_idx
  on public.portal_payees(reviewed_by)
  where reviewed_by is not null;

create index if not exists portal_recoupments_reviewed_by_idx
  on public.portal_recoupments(reviewed_by)
  where reviewed_by is not null;
create index if not exists portal_recoupments_track_idx
  on public.portal_recoupments(track_id)
  where track_id is not null;

create index if not exists royalty_split_rules_created_by_idx
  on public.royalty_split_rules(created_by)
  where created_by is not null;
create index if not exists royalty_split_rules_reviewed_by_idx
  on public.royalty_split_rules(reviewed_by)
  where reviewed_by is not null;
create index if not exists royalty_split_rules_scope_release_idx
  on public.royalty_split_rules(scope_release_id)
  where scope_release_id is not null;
create index if not exists royalty_split_rules_scope_track_idx
  on public.royalty_split_rules(scope_track_id)
  where scope_track_id is not null;

create index if not exists royalty_split_shares_party_user_idx
  on public.royalty_split_shares(party_user_id)
  where party_user_id is not null;

create index if not exists split_track_assignments_reviewed_by_idx
  on public.split_track_assignments(reviewed_by)
  where reviewed_by is not null;
create index if not exists split_track_assignments_rule_idx
  on public.split_track_assignments(split_rule_id);

create index if not exists splitshare_allocations_beneficiary_transfer_idx
  on public.splitshare_allocations(beneficiary_transfer_ledger_entry_id)
  where beneficiary_transfer_ledger_entry_id is not null;
create index if not exists splitshare_allocations_held_ledger_idx
  on public.splitshare_allocations(held_ledger_entry_id)
  where held_ledger_entry_id is not null;
create index if not exists splitshare_allocations_owner_transfer_idx
  on public.splitshare_allocations(owner_transfer_ledger_entry_id)
  where owner_transfer_ledger_entry_id is not null;
create index if not exists splitshare_allocations_rule_idx
  on public.splitshare_allocations(split_rule_id);
create index if not exists splitshare_allocations_share_idx
  on public.splitshare_allocations(split_share_id);
create index if not exists splitshare_allocations_track_idx
  on public.splitshare_allocations(track_id)
  where track_id is not null;
