-- Admin post-approval correction flow.
-- Keeps approved-but-not-delivered releases editable/resubmittable without inventing
-- or mutating TooLost delivery state. The provider workflow remains authoritative once
-- a provider_release_id exists.

create or replace function public.return_approved_release_for_changes(
  p_release_id uuid,
  p_artist_visible_reason text,
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
  review public.qc_reviews;
  reason text := nullif(trim(coalesce(p_artist_visible_reason, '')), '');
begin
  if actor is null or not (
    public.has_role(actor, 'admin')
    or public.has_role(actor, 'super_admin')
    or public.has_role(actor, 'support')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if reason is null then
    raise exception 'Artist / label visible correction reason is required'
      using errcode = 'P0001';
  end if;

  select *
  into r
  from public.releases
  where id = p_release_id
  for update;

  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if r.status <> 'approved' then
    raise exception 'Only an approved release can be returned for changes (got %)', r.status
      using errcode = 'P0001';
  end if;

  if r.provider_release_id is not null then
    raise exception 'Release already exists at TooLost; use provider edit/takedown workflow'
      using errcode = 'P0001';
  end if;

  -- transition_release_status is the single authoritative status machine.
  -- approved -> changes_requested clears locked_at, persists the visible reason,
  -- writes status history, updates the QC queue trigger, and queues the normal
  -- owner notification/email.
  perform public.transition_release_status(
    p_release_id,
    'changes_requested',
    reason,
    jsonb_build_object(
      'source', 'admin_post_approval_review',
      'decision', 'request_changes',
      'post_approval', true,
      'owner_can_edit_and_resubmit', true,
      'internal_note', coalesce(p_internal_note, '')
    )
  );

  insert into public.qc_reviews (
    release_id,
    reviewer_user_id,
    decision,
    checklist,
    artist_visible_reason,
    internal_note,
    previous_status,
    new_status
  ) values (
    p_release_id,
    actor,
    'request_changes',
    jsonb_build_object(
      'post_approval', true,
      'provider_submission_started', false
    ),
    reason,
    nullif(trim(coalesce(p_internal_note, '')), ''),
    'approved',
    'changes_requested'
  )
  returning * into review;

  update public.qc_queue_items
  set
    status = 'completed',
    assigned_to = coalesce(assigned_to, actor),
    updated_at = now()
  where release_id = p_release_id;

  return review;
end;
$$;

revoke all on function public.return_approved_release_for_changes(uuid, text, text) from public;
grant execute on function public.return_approved_release_for_changes(uuid, text, text) to authenticated;

comment on function public.return_approved_release_for_changes(uuid, text, text)
is 'Returns an approved pre-delivery release to changes_requested so its artist/label owner can edit and resubmit. Blocks releases already created at TooLost.';
