-- Reconcile the canonical admin release-correction RPC into source control.
-- This is deliberately pre-delivery only: queued local work can be cancelled,
-- but once a TooLost provider release exists or provider submission starts,
-- admins must use the provider edit/takedown workflow.

create or replace function public.admin_reopen_release_for_corrections(
  p_release_id uuid,
  p_reason text
)
returns public.releases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_release public.releases;
  v_previous_status public.release_status;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_actor is null or not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role in ('admin', 'super_admin')
  ) then
    raise exception 'Administrator permission required' using errcode = '42501';
  end if;

  if v_reason is null or char_length(v_reason) < 4 then
    raise exception 'A clear correction reason is required' using errcode = '22023';
  end if;

  select *
  into v_release
  from public.releases
  where id = p_release_id
  for update;

  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  v_previous_status := v_release.status;

  if v_release.status not in ('approved', 'scheduled', 'failed') then
    raise exception 'Only approved, scheduled, or failed releases can be reopened for corrections (got %)', v_release.status
      using errcode = '22023';
  end if;

  -- A provider release id means TooLost already accepted/created the release.
  -- Local edits must never silently diverge from provider metadata.
  if v_release.provider_release_id is not null then
    raise exception 'This release already exists at TooLost. Use the provider edit/takedown workflow instead.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.distribution_jobs j
    where j.release_id = p_release_id
      and j.status in (
        'submitting',
        'submitted',
        'syncing',
        'delivered',
        'live',
        'takedown_requested',
        'taken_down',
        'reinstating'
      )
  ) then
    raise exception 'Distribution has already started for this release. Use the provider edit/takedown workflow instead of reopening it.'
      using errcode = 'P0001';
  end if;

  -- Queued/failed work has not crossed the TooLost boundary and can be safely cancelled.
  update public.distribution_jobs
  set status = 'cancelled',
      last_error = null,
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'cancelled_for_corrections_at', now(),
        'cancelled_by', v_actor
      )
  where release_id = p_release_id
    and status in ('queued', 'failed');

  v_release := public.transition_release_status(
    p_release_id,
    'changes_requested'::public.release_status,
    v_reason,
    jsonb_build_object(
      'source', 'admin_correction',
      'post_approval', true,
      'owner_can_edit_and_resubmit', true
    )
  );

  -- Keep the post-approval correction visible in the same QC history used by
  -- normal QC decisions.
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
    v_actor,
    'request_changes',
    jsonb_build_object(
      'post_approval', true,
      'provider_submission_started', false
    ),
    v_reason,
    null,
    v_previous_status,
    'changes_requested'
  );

  insert into public.notifications (
    user_id, type, title, body, entity_type, entity_id
  ) values (
    v_release.owner_user_id,
    'qc_changes_requested',
    'Release changes required',
    v_reason,
    'release',
    p_release_id
  );

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor,
    'release_status_change'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object(
      'previous_status', v_previous_status,
      'status', 'changes_requested',
      'reason', v_reason,
      'source', 'admin_correction',
      'owner_can_edit_and_resubmit', true
    )
  );

  return v_release;
end;
$$;

revoke all on function public.admin_reopen_release_for_corrections(uuid, text) from public;
revoke execute on function public.admin_reopen_release_for_corrections(uuid, text) from anon;
grant execute on function public.admin_reopen_release_for_corrections(uuid, text) to authenticated;

comment on function public.admin_reopen_release_for_corrections(uuid, text)
is 'Admin-only pre-delivery correction workflow. Cancels safe queued work, moves the release to changes_requested, records the reason/QC history, and lets the artist or label edit and resubmit. Blocks once TooLost submission has started.';
