-- NEXO Batch 5 hardening: eliminate bypasses and private-note leakage.

-- QC queue writes only through race-safe SECURITY DEFINER functions / release trigger.
drop policy if exists "qc_queue_staff" on public.qc_queue_items;
create policy "qc_queue_staff_select" on public.qc_queue_items
  for select to authenticated
  using (public.is_admin_portal_staff(auth.uid()));

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

  update public.qc_queue_items
  set priority = p_priority, updated_at = now()
  where id = p_item_id
  returning * into item;
  if not found then raise exception 'QC item not found' using errcode = 'P0002'; end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'qc_claim', 'qc_queue_item', item.id, jsonb_build_object('priority', p_priority::text));
  return item;
end;
$$;
revoke all on function public.set_qc_item_priority(uuid, public.qc_priority) from public;
grant execute on function public.set_qc_item_priority(uuid, public.qc_priority) to authenticated;

-- Replace QC decision so internal notes only enter staff-only qc_reviews,
-- never artist-visible release_status_history.metadata.
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
  if actor is null or not public.is_admin_portal_staff(actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then raise exception 'Release not found' using errcode = 'P0002'; end if;
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

-- Requesters may read/create tickets and messages, but only staff changes ticket workflow fields.
drop policy if exists "support_tickets_update" on public.support_tickets;
create policy "support_tickets_update_staff" on public.support_tickets
  for update to authenticated
  using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()));

-- Payout workflow: updates only through gated RPC. PAID remains unavailable here.
drop policy if exists "payouts_staff_update" on public.payouts;

create or replace function public.transition_payout_status(
  p_payout_id uuid,
  p_new_status public.payout_status,
  p_reason text default null
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  p public.payouts;
  allowed boolean := false;
begin
  if actor is null or not (
    public.has_role(actor, 'admin') or public.has_role(actor, 'super_admin')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into p from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'Payout not found' using errcode = 'P0002'; end if;
  if p_new_status = 'paid' then
    raise exception 'PAID requires a real payment operation' using errcode = '42501';
  end if;

  allowed := case p.status
    when 'pending' then p_new_status in ('approved', 'cancelled', 'on_hold')
    when 'approved' then p_new_status in ('processing', 'cancelled', 'on_hold')
    when 'processing' then p_new_status in ('failed', 'on_hold')
    when 'on_hold' then p_new_status in ('pending', 'approved', 'cancelled')
    when 'failed' then p_new_status in ('pending', 'cancelled')
    else false
  end;
  if not allowed then
    raise exception 'Invalid payout transition from % to %', p.status, p_new_status
      using errcode = 'P0001';
  end if;

  update public.payouts set status = p_new_status, updated_at = now()
  where id = p_payout_id returning * into p;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor, 'payout_status_change', 'payout', p.id,
    jsonb_build_object('status', p_new_status::text, 'reason', coalesce(p_reason, ''))
  );
  return p;
end;
$$;
revoke all on function public.transition_payout_status(uuid, public.payout_status, text) from public;
grant execute on function public.transition_payout_status(uuid, public.payout_status, text) to authenticated;

-- Public contact abuse guard (per normalized email; app does not trust forwarded IP headers).
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
  normalized_email text := lower(trim(p_email));
begin
  if p_name is null or length(trim(p_name)) < 2 then raise exception 'Invalid name'; end if;
  if p_email is null or p_email !~ '^[^@]+@[^@]+\.[^@]+$' then raise exception 'Invalid email'; end if;
  if p_subject is null or length(trim(p_subject)) < 2 then raise exception 'Invalid subject'; end if;
  if p_message is null or length(trim(p_message)) < 10 then raise exception 'Invalid message'; end if;
  if length(p_name) > 200 or length(p_email) > 320 or length(p_subject) > 300 or length(p_message) > 10000 then
    raise exception 'Field too long';
  end if;

  if (select count(*) from public.contact_messages
      where email = normalized_email and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many contact submissions; try later' using errcode = 'P0001';
  end if;

  insert into public.contact_messages (name, email, subject, message, source_ip, user_agent)
  values (
    trim(p_name), normalized_email, trim(p_subject), trim(p_message),
    left(p_source_ip, 100), left(p_user_agent, 500)
  ) returning id into new_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (null, 'contact_message', 'contact_message', new_id, '{}'::jsonb);
  return new_id;
end;
$$;
