-- NEXO Batch 5 independent verification hardening
-- Closes: audit forge via direct insert, email "sent" without provider,
-- account restriction enforcement at submit RPC.

-- 1) Ordinary clients must not INSERT audit rows directly.
drop policy if exists "audit_logs_insert_own" on public.audit_logs;

-- Staff/user allowlisted write_audit_log (no arbitrary action forging).
create or replace function public.write_audit_log(
  p_action public.audit_action,
  p_entity_type text default 'user',
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  safe_meta jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required to write audit logs' using errcode = '42501';
  end if;

  if p_action in (
    'login', 'logout', 'profile_update', 'password_reset_request',
    'signup', 'email_verified', 'release_submit', 'release_update',
    'release_status_change', 'release_create', 'release_duplicate',
    'release_takedown_request', 'asset_upload'
  ) then
    null; -- any authenticated user for own operational events
  elsif p_action in (
    'qc_review', 'qc_claim', 'qc_bulk', 'ticket_update', 'compliance_update',
    'admin_search', 'contact_message', 'payout_status_change', 'royalty_adjustment',
    'account_suspend', 'account_restore', 'account_restrict'
  ) then
    if not public.is_admin_portal_staff(uid) then
      raise exception 'Audit action requires staff privileges' using errcode = '42501';
    end if;
  elsif p_action in ('status_change', 'settings_update', 'report_export') then
    if not (public.has_role(uid, 'admin') or public.has_role(uid, 'super_admin')) then
      raise exception 'Audit action requires admin privileges' using errcode = '42501';
    end if;
  elsif p_action = 'role_change' then
    if not public.has_role(uid, 'super_admin') then
      raise exception 'role_change audit requires super_admin' using errcode = '42501';
    end if;
  else
    raise exception 'Audit action not allowed' using errcode = '42501';
  end if;

  safe_meta := coalesce(p_metadata, '{}'::jsonb)
    - 'password' - 'token' - 'access_token' - 'refresh_token' - 'service_role_key'
    - 'internal_note';

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, p_action, p_entity_type, coalesce(p_entity_id, uid), safe_meta)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.write_audit_log(public.audit_action, text, uuid, jsonb) from public;
grant execute on function public.write_audit_log(public.audit_action, text, uuid, jsonb) to authenticated;

-- 2) Email events may never claim sent without a real provider identity.
create or replace function public.protect_email_outbound_sent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'sent' then
    if new.provider is null or length(trim(new.provider)) = 0
       or new.provider_message_id is null or length(trim(new.provider_message_id)) = 0 then
      raise exception 'email status sent requires provider and provider_message_id'
        using errcode = 'P0001';
    end if;
    if lower(trim(new.provider)) in ('none', 'not_connected', 'fake', 'test') then
      raise exception 'email status sent requires a real provider' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists email_outbound_protect_sent on public.email_outbound_events;
create trigger email_outbound_protect_sent
  before insert or update on public.email_outbound_events
  for each row execute function public.protect_email_outbound_sent();

-- 3) Account restriction helper + submit gate.
create or replace function public.assert_account_may_mutate()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.account_status;
  rk public.account_restriction_kind;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select account_status, restriction_kind into st, rk
  from public.profiles where id = uid;
  if st in ('suspended', 'deactivated') then
    raise exception 'Account is blocked' using errcode = '42501';
  end if;
  if rk in ('submit_blocked', 'read_only', 'login_restricted') then
    raise exception 'Account restriction prevents this action' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_account_may_mutate() from public;
grant execute on function public.assert_account_may_mutate() to authenticated;

create or replace function public.submit_release_to_qc(
  p_release_id uuid,
  p_validation_snapshot jsonb default '{}'::jsonb,
  p_notes text default null
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.releases;
  actor uuid := auth.uid();
  staff_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform public.assert_account_may_mutate();

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;
  if r.owner_user_id <> actor then
    raise exception 'Not release owner' using errcode = '42501';
  end if;
  if r.status not in ('draft', 'changes_requested') then
    raise exception 'Release already submitted or locked (status=%)', r.status
      using errcode = 'P0001';
  end if;

  update public.release_submissions
  set superseded = true
  where release_id = p_release_id and not superseded;

  insert into public.release_submissions (release_id, submitted_by, validation_snapshot, notes)
  values (p_release_id, actor, coalesce(p_validation_snapshot, '{}'::jsonb), p_notes);

  r := public.transition_release_status(
    p_release_id, 'submitted', p_notes,
    jsonb_build_object('source', 'submit_release_to_qc')
  );

  for staff_id in
    select distinct ur.user_id from public.user_roles ur
    where ur.role in ('admin', 'super_admin', 'support')
  loop
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      staff_id,
      'release_submitted',
      'Release submitted for QC',
      coalesce(r.title, 'Untitled') || ' was submitted for quality control.',
      'release',
      r.id
    );
  end loop;

  return r;
end;
$$;

revoke all on function public.submit_release_to_qc(uuid, jsonb, text) from public;
grant execute on function public.submit_release_to_qc(uuid, jsonb, text) to authenticated;

-- Indexes aiding admin date-filtered datasets
create index if not exists audit_logs_created_at_action_idx
  on public.audit_logs (created_at desc, action);
create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);
create index if not exists support_tickets_created_at_idx
  on public.support_tickets (created_at desc);
create index if not exists payouts_created_at_idx
  on public.payouts (created_at desc);
create index if not exists ledger_entries_created_at_idx
  on public.ledger_entries (created_at desc);
