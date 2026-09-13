-- NEXO Batch 5 independent security audit fixes
-- 1) Prevent artists/labels from clearing restriction_kind / privilege fields
-- 2) Enforce account suspend/restrict at release mutate path
-- 3) Race-safe QC priority update (FOR UPDATE)
-- 4) Report export inserts always audited in DB
-- 5) Support attachment inserts must target own/staff-visible messages
-- 6) QC approve checklist enforced at RPC (DB source of truth)

-- ---------------------------------------------------------------------------
-- 1) Privilege trigger: also protect restriction_kind
-- ---------------------------------------------------------------------------
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_type is not distinct from old.account_type
     and new.account_status is not distinct from old.account_status
     and new.restriction_kind is not distinct from old.restriction_kind then
    return new;
  end if;

  if current_setting('nexo.internal_profile_update', true) = '1' then
    return new;
  end if;

  if auth.uid() is null
     or public.has_role(auth.uid(), 'admin')
     or public.has_role(auth.uid(), 'super_admin') then
    return new;
  end if;

  raise exception 'Changing account_type, account_status, or restriction_kind requires admin privileges'
    using errcode = '42501';
end;
$$;

-- Pin restriction_kind in owner update RLS (additive recreate)
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and account_type = (select p.account_type from public.profiles p where p.id = auth.uid())
    and account_status = (select p.account_status from public.profiles p where p.id = auth.uid())
    and restriction_kind = (select p.restriction_kind from public.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2) Block suspended / restricted accounts from mutating releases at DB
-- ---------------------------------------------------------------------------
create or replace function public.protect_release_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  staff boolean;
  internal boolean;
begin
  internal := current_setting('nexo.internal_release_update', true) = '1';
  staff := auth.uid() is null
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support');

  if tg_op = 'INSERT' then
    if not staff and not internal then
      perform public.assert_account_may_mutate();
      new.status := 'draft';
      new.provider_name := null;
      new.provider_release_id := null;
      new.provider_status := null;
      new.provider_metadata := '{}'::jsonb;
      new.provider_connected := false;
      new.locked_at := null;
      new.submitted_at := null;
      new.rejection_reason := null;
      new.changes_requested_reason := null;
      if auth.uid() is not null then
        new.owner_user_id := auth.uid();
      end if;
    end if;
    return new;
  end if;

  if staff or internal then
    return new;
  end if;

  perform public.assert_account_may_mutate();

  if new.status is distinct from old.status then
    raise exception 'Status changes must go through server-enforced transitions'
      using errcode = '42501';
  end if;

  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'owner_user_id is not user-editable'
      using errcode = '42501';
  end if;

  if new.provider_name is distinct from old.provider_name
     or new.provider_release_id is distinct from old.provider_release_id
     or new.provider_status is distinct from old.provider_status
     or new.provider_metadata is distinct from old.provider_metadata
     or new.provider_connected is distinct from old.provider_connected
     or new.locked_at is distinct from old.locked_at
     or new.submitted_at is distinct from old.submitted_at
     or new.rejection_reason is distinct from old.rejection_reason
     or new.changes_requested_reason is distinct from old.changes_requested_reason then
    raise exception 'Provider, lock, and QC reason fields are not user-editable'
      using errcode = '42501';
  end if;

  if old.status not in ('draft', 'changes_requested') then
    raise exception 'Release is locked and cannot be edited in status %', old.status
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_release_child_editability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
  staff boolean;
begin
  staff := auth.uid() is null
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support');
  if staff or current_setting('nexo.internal_release_update', true) = '1' then
    return coalesce(new, old);
  end if;

  perform public.assert_account_may_mutate();

  rid := coalesce(new.release_id, old.release_id);
  if not public.release_is_editable(rid) then
    raise exception 'Release content is locked'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) QC priority: FOR UPDATE race safety
-- ---------------------------------------------------------------------------
create or replace function public.set_qc_item_priority(
  p_item_id uuid,
  p_priority public.qc_priority
)
returns public.qc_queue_items
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  item public.qc_queue_items;
begin
  if actor is null or not public.is_admin_portal_staff(actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into item from public.qc_queue_items where id = p_item_id for update;
  if not found then raise exception 'QC item not found' using errcode = 'P0002'; end if;

  update public.qc_queue_items
  set priority = p_priority, updated_at = now()
  where id = p_item_id
  returning * into item;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'qc_claim', 'qc_queue_item', item.id, jsonb_build_object('priority', p_priority::text));
  return item;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Report exports: DB-level audit on insert
-- ---------------------------------------------------------------------------
create or replace function public.audit_report_export_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    new.requested_by,
    'report_export',
    'report_export',
    new.id,
    jsonb_build_object('report_type', new.report_type, 'status', new.status)
  );
  return new;
end;
$$;

drop trigger if exists report_exports_audit_insert on public.report_exports;
create trigger report_exports_audit_insert
  after insert on public.report_exports
  for each row execute function public.audit_report_export_insert();

-- ---------------------------------------------------------------------------
-- 5) Support attachment row must belong to own ticket message (or staff)
-- ---------------------------------------------------------------------------
drop policy if exists "support_attachments_insert" on public.support_attachments;
create policy "support_attachments_insert" on public.support_attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_admin_portal_staff(auth.uid())
      or exists (
        select 1
        from public.support_messages m
        join public.support_tickets t on t.id = m.ticket_id
        where m.id = message_id
          and t.requester_user_id = auth.uid()
          and m.is_internal = false
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 6) perform_qc_decision: checklist required for approve (DB)
-- ---------------------------------------------------------------------------
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
  checklist jsonb := coalesce(p_checklist, '{}'::jsonb);
begin
  if actor is null or not public.is_admin_portal_staff(actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then raise exception 'Release not found' using errcode = 'P0002'; end if;
  if r.status not in ('submitted', 'in_qc') then
    raise exception 'Release is not in a QC-able status' using errcode = 'P0001';
  end if;

  if p_decision = 'approve' then
    if not (
      coalesce((checklist->>'metadata_complete')::boolean, false)
      and coalesce((checklist->>'artwork_ok')::boolean, false)
      and coalesce((checklist->>'audio_ok')::boolean, false)
      and coalesce((checklist->>'rights_cleared')::boolean, false)
      and coalesce((checklist->>'territories_ok')::boolean, false)
      and coalesce((checklist->>'explicit_flagged')::boolean, false)
      and coalesce((checklist->>'isrc_upc_format')::boolean, false)
      and coalesce((checklist->>'no_policy_violation')::boolean, false)
    ) then
      raise exception 'All checklist items must pass before approve' using errcode = 'P0001';
    end if;
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
      'checklist', checklist
    )
  );

  insert into public.qc_reviews (
    release_id, reviewer_user_id, decision, checklist,
    artist_visible_reason, internal_note, previous_status, new_status
  ) values (
    p_release_id, actor, p_decision, checklist,
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

-- Pin ledger immutability search_path (non-DEFINER trigger hygiene)
create or replace function public.protect_ledger_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Ledger entries are immutable' using errcode = '42501';
end;
$$;
