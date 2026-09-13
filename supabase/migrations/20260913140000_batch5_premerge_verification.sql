-- NEXO Batch 5 pre-merge verification
-- Enforce QC approve checklist at the RPC (no app-only bypass).
-- Pin ledger trigger search_path.

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

create or replace function public.protect_ledger_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Ledger entries are immutable' using errcode = '42501';
end;
$$;
