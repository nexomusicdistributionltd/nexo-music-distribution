-- Re-apply functional QC RBAC after release-owner email migrations redefine QC RPCs.
-- Keeps QC access permission-based and prevents broad support-role access from returning.

-- Release decline / return-for-changes email hardening.
-- Ensures post-approval delivery validation failures (including FLAC) notify
-- only the affected release owner with complete correction instructions.
-- Also suppresses an unsent approval email when the same request immediately
-- returns the release for corrections.

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
  v_review public.qc_reviews;
  v_owner_email text;
  v_first_name text;
  v_track_number_text text;
  v_affected_tracks text := '';
  v_is_flac boolean := false;
  v_correction_title text;
  v_email_reason text;
  v_required_format text := '';
  v_action_required text := '';
  v_resubmit_instruction text := '';
begin
  if v_actor is null or not public.has_staff_permission(v_actor, 'admin:qc') then
    raise exception 'QC permission required' using errcode = '42501';
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

  if v_release.provider_release_id is not null then
    raise exception 'This release already exists at the distribution provider. Use the provider edit/takedown workflow instead.'
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
  )
  returning * into v_review;

  -- If approval and delivery validation happen in the same request, do not send
  -- a stale approval email followed by a correction email.
  update public.email_outbound_events
  set status = 'skipped',
      error = 'Superseded by changes required before approval email dispatch',
      updated_at = now()
  where template_key = 'RELEASE_APPROVED'
    and status in ('queued', 'pending')
    and payload->>'_related_release_id' = p_release_id::text;

  insert into public.notifications (
    user_id, type, title, body, entity_type, entity_id
  ) values (
    v_release.owner_user_id,
    'qc_changes_requested',
    case
      when position('flac' in lower(v_reason)) > 0 then 'Audio File Requires Attention'
      else 'Release changes required'
    end,
    v_reason,
    'release',
    p_release_id
  );

  select
    p.email,
    split_part(
      coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), p.email),
      ' ',
      1
    )
  into v_owner_email, v_first_name
  from public.profiles p
  where p.id = v_release.owner_user_id;

  v_is_flac := position('flac' in lower(v_reason)) > 0;

  select (regexp_match(v_reason, '(?i)track[[:space:]]+([0-9]+)'))[1]
    into v_track_number_text;

  if v_track_number_text is not null then
    select
      rt.track_number::text || '. ' || coalesce(nullif(rt.title, ''), 'Untitled track') ||
      case
        when nullif(rt.isrc, '') is not null then ' — ISRC ' || rt.isrc
        else ''
      end
    into v_affected_tracks
    from public.release_tracks rt
    where rt.release_id = p_release_id
      and rt.track_number = v_track_number_text::int
    limit 1;
  end if;

  if coalesce(v_affected_tracks, '') = '' then
    select coalesce(
      string_agg(
        rt.track_number::text || '. ' || coalesce(nullif(rt.title, ''), 'Untitled track') ||
        case
          when nullif(rt.isrc, '') is not null then ' — ISRC ' || rt.isrc
          else ''
        end,
        E'\n' order by rt.track_number
      ),
      ''
    )
    into v_affected_tracks
    from public.release_tracks rt
    where rt.release_id = p_release_id;
  end if;

  if v_is_flac then
    v_correction_title := 'Audio File Requires Attention';
    v_email_reason := 'This track cannot be delivered to distribution services because the uploaded audio file does not meet the required delivery format.';
    v_required_format := 'FLAC (lossless audio)';
    v_action_required := 'Please replace the current audio file with a lossless FLAC file and resubmit the release for review.';
    v_resubmit_instruction := 'Once the corrected FLAC file has been uploaded, resubmit the release and our team will review it again.';
  else
    v_correction_title := 'Release Changes Required';
    v_email_reason := v_reason;
  end if;

  if v_owner_email is not null and btrim(v_owner_email) <> '' then
    perform public.enqueue_email_event(
      'release.qc',
      'RELEASE_CHANGES_REQUIRED',
      v_release.owner_user_id,
      v_owner_email,
      p_release_id,
      'release',
      p_release_id,
      jsonb_build_object(
        'FIRST_NAME', coalesce(v_first_name, 'there'),
        'CORRECTION_TITLE', v_correction_title,
        'RELEASE_TITLE', coalesce(v_release.title, ''),
        'RELEASE_ID', v_release.id::text,
        'ARTIST_NAME', coalesce(v_release.primary_artist_name, ''),
        'LABEL_NAME', coalesce(v_release.label_name, ''),
        'UPC', coalesce(v_release.upc, ''),
        'RELEASE_DATE', coalesce(v_release.release_date::text, ''),
        'STATUS', 'changes_requested',
        'STATUS_LABEL', 'Changes required',
        'REASON', v_email_reason,
        'ARTIST_VISIBLE_REASON', v_reason,
        'AFFECTED_TRACKS', coalesce(v_affected_tracks, ''),
        'REQUIRED_FORMAT', v_required_format,
        'ACTION_REQUIRED', v_action_required,
        'RESUBMIT_INSTRUCTION', v_resubmit_instruction,
        'CTA_URL', 'https://nexomusicdistribution.com/dashboard/releases/' || p_release_id::text,
        'CTA_LABEL', 'Replace audio & resubmit',
        'PREHEADER', v_correction_title || ' — ' || coalesce(v_release.title, 'Release')
      ),
      'RELEASE_CHANGES_REQUIRED:' || p_release_id::text || ':' || v_review.id::text,
      v_actor
    );
  end if;

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
      'owner_can_edit_and_resubmit', true,
      'correction_email_enqueued', v_owner_email is not null,
      'correction_type', case when v_is_flac then 'audio_flac_required' else 'general' end
    )
  );

  return v_release;
end;
$$;

revoke all on function public.admin_reopen_release_for_corrections(uuid, text) from public;
revoke execute on function public.admin_reopen_release_for_corrections(uuid, text) from anon;
grant execute on function public.admin_reopen_release_for_corrections(uuid, text) to authenticated;


-- Normalize manual QC decision emails so decline/reject reasons are never blank
-- and release changes-required emails contain actionable correction details.

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
  tmpl text;
  owner_rec record;
  owner_first_name text := 'there';
  affected_tracks text := '';
  reason_text text := nullif(btrim(coalesce(p_artist_visible_reason, '')), '');
  is_flac boolean := false;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:qc') then
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
    tmpl := 'RELEASE_APPROVED';
  elsif p_decision = 'request_changes' then
    new_status := 'changes_requested';
    tmpl := 'RELEASE_CHANGES_REQUIRED';
    if reason_text is null then
      raise exception 'Artist-visible reason required for request_changes' using errcode = 'P0001';
    end if;
  elsif p_decision = 'reject' then
    new_status := 'rejected';
    tmpl := 'RELEASE_REJECTED';
    if reason_text is null then
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

  select coalesce(
    string_agg(
      rt.track_number::text || '. ' || coalesce(nullif(rt.title, ''), 'Untitled track') ||
      case
        when nullif(rt.isrc, '') is not null then ' — ISRC ' || rt.isrc
        else ''
      end,
      E'\n' order by rt.track_number
    ),
    ''
  )
  into affected_tracks
  from public.release_tracks rt
  where rt.release_id = p_release_id;

  is_flac := position('flac' in lower(coalesce(reason_text, ''))) > 0;

  select * into owner_rec from public._email_release_owner(p_release_id);
  if owner_rec.owner_id is not null then
    select split_part(
      coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), p.email, 'there'),
      ' ',
      1
    )
    into owner_first_name
    from public.profiles p
    where p.id = owner_rec.owner_id;
  end if;

  if owner_rec.owner_id is not null and tmpl is not null then
    perform public.enqueue_email_event(
      'release.qc',
      tmpl,
      owner_rec.owner_id,
      owner_rec.owner_email,
      p_release_id,
      'qc_review',
      review.id,
      jsonb_build_object(
        'FIRST_NAME', coalesce(owner_first_name, 'there'),
        'RELEASE_TITLE', coalesce(owner_rec.release_title, ''),
        'ARTIST_NAME', coalesce(owner_rec.artist_name, ''),
        'STATUS', new_status::text,
        'STATUS_LABEL', initcap(replace(new_status::text, '_', ' ')),
        'ARTIST_VISIBLE_REASON', coalesce(reason_text, ''),
        'REASON', coalesce(reason_text, ''),
        'CORRECTION_TITLE',
          case
            when p_decision = 'request_changes' and is_flac then 'Audio File Requires Attention'
            when p_decision = 'request_changes' then 'Release Changes Required'
            when p_decision = 'reject' then 'Release Rejected'
            else ''
          end,
        'AFFECTED_TRACKS', affected_tracks,
        'REQUIRED_FORMAT',
          case when p_decision = 'request_changes' and is_flac then 'FLAC (lossless audio)' else '' end,
        'ACTION_REQUIRED',
          case
            when p_decision = 'request_changes' and is_flac
              then 'Please replace the current audio file with a lossless FLAC file and resubmit the release for review.'
            else ''
          end,
        'RESUBMIT_INSTRUCTION',
          case
            when p_decision = 'request_changes' and is_flac
              then 'Once the corrected FLAC file has been uploaded, resubmit the release and our team will review it again.'
            else ''
          end,
        'RELEASE_ID', p_release_id::text,
        'CTA_URL', 'https://nexomusicdistribution.com/dashboard/releases/' || p_release_id::text,
        'CTA_LABEL',
          case
            when p_decision = 'request_changes' then 'Update release & resubmit'
            else 'View release'
          end,
        'PREHEADER',
          case
            when p_decision = 'request_changes' and is_flac then 'Audio File Requires Attention — ' || coalesce(owner_rec.release_title, 'Release')
            when p_decision = 'request_changes' then 'Changes required — ' || coalesce(owner_rec.release_title, 'Release')
            when p_decision = 'reject' then 'Release rejected — ' || coalesce(owner_rec.release_title, 'Release')
            else 'Release approved — ' || coalesce(owner_rec.release_title, 'Release')
          end
      ),
      tmpl || ':' || p_release_id::text || ':' || new_status::text || ':' || review.id::text,
      actor
    );
  end if;

  return review;
end;
$$;

revoke execute on function public.perform_qc_decision(
  uuid, public.qc_decision, jsonb, text, text
) from anon;
revoke execute on function public.perform_qc_decision(
  uuid, public.qc_decision, jsonb, text, text
) from public;
grant execute on function public.perform_qc_decision(
  uuid, public.qc_decision, jsonb, text, text
) to authenticated, service_role;
