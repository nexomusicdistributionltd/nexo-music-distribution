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
  if actor is null or not (
    public.has_role(actor, 'admin')
    or public.has_role(actor, 'super_admin')
    or public.has_role(actor, 'support')
  ) then
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
