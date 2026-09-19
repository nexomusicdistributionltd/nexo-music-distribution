-- Allow admins to update/resend correction reasons while a release is already changes_requested.
-- Keeps owner-only notification/email/audit behavior in the canonical correction RPC.

CREATE OR REPLACE FUNCTION public.admin_reopen_release_for_corrections(p_release_id uuid, p_reason text)
 RETURNS releases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_already_changes_requested boolean := false;
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
  v_already_changes_requested := v_release.status = 'changes_requested';

  if v_release.status not in ('approved', 'scheduled', 'failed', 'changes_requested') then
    raise exception 'Only approved, scheduled, failed, or already-declined releases can be returned for corrections (got %)', v_release.status
      using errcode = '22023';
  end if;

  if not v_already_changes_requested then
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
  else
    update public.releases
    set changes_requested_reason = v_reason,
        updated_at = now()
    where id = p_release_id
    returning * into v_release;
  end if;

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
      'provider_submission_started', false,
      'correction_resend', v_already_changes_requested
    ),
    v_reason,
    null,
    v_previous_status,
    'changes_requested'
  )
  returning * into v_review;

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
        'CTA_LABEL', case when v_is_flac then 'Replace audio & resubmit' else 'Update release & resubmit' end,
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
      'source', case when v_already_changes_requested then 'admin_correction_resend' else 'admin_correction' end,
      'owner_can_edit_and_resubmit', true,
      'correction_email_enqueued', v_owner_email is not null,
      'correction_type', case when v_is_flac then 'audio_flac_required' else 'general' end,
      'correction_resend', v_already_changes_requested
    )
  );

  return v_release;
end;
$function$

