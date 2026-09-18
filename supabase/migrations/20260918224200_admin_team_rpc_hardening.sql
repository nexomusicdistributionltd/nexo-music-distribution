-- NEXO functional team RPC hardening.
-- These SECURITY DEFINER entry points now require the same functional permission
-- enforced by the admin UI and RLS policies.

-- admin_enqueue_composed_email: admin:emails
CREATE OR REPLACE FUNCTION public.admin_enqueue_composed_email(p_to_email text, p_template_key text, p_payload jsonb, p_related_entity_type text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  eid uuid;
begin
  if uid is null or not public.has_staff_permission(uid, 'admin:emails') then
    raise exception 'Administrator email permission required'
      using errcode = '42501';
  end if;

  insert into public.email_outbound_events(
    to_email,
    template_key,
    payload,
    status,
    related_entity_type
  )
  values(
    lower(btrim(p_to_email)),
    p_template_key,
    coalesce(p_payload, '{}'::jsonb),
    'queued',
    p_related_entity_type
  )
  returning id into eid;

  return eid;
end;
$function$

-- admin_set_artist_website: admin:website
CREATE OR REPLACE FUNCTION public.admin_set_artist_website(p_artist_profile_id uuid, p_published boolean DEFAULT NULL::boolean, p_featured boolean DEFAULT NULL::boolean, p_slug text DEFAULT NULL::text, p_tagline text DEFAULT NULL::text, p_bio_html text DEFAULT NULL::text, p_bio_json jsonb DEFAULT NULL::jsonb, p_social_links jsonb DEFAULT NULL::jsonb, p_sort_order integer DEFAULT NULL::integer, p_artist_name text DEFAULT NULL::text, p_genres text[] DEFAULT NULL::text[], p_country text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text, p_cover_url text DEFAULT NULL::text)
 RETURNS artist_profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  a public.artist_profiles;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:website') then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  update public.artist_profiles set
    website_published = coalesce(p_published, website_published),
    website_featured = coalesce(p_featured, website_featured),
    public_slug = case
      when p_slug is null then public_slug
      when nullif(trim(p_slug), '') is null then null
      else lower(regexp_replace(trim(p_slug), '[^a-z0-9-]+', '-', 'gi'))
    end,
    public_tagline = coalesce(p_tagline, public_tagline),
    public_bio_html = coalesce(p_bio_html, public_bio_html),
    public_bio_json = coalesce(p_bio_json, public_bio_json),
    social_links = coalesce(p_social_links, social_links),
    website_sort_order = coalesce(p_sort_order, website_sort_order),
    artist_name = coalesce(nullif(trim(p_artist_name), ''), artist_name),
    genres = coalesce(p_genres, genres),
    country = case when p_country is null then country else nullif(trim(p_country), '') end,
    avatar_url = case when p_avatar_url is null then avatar_url else nullif(trim(p_avatar_url), '') end,
    cover_url = case when p_cover_url is null then cover_url else nullif(trim(p_cover_url), '') end,
    updated_at = now()
  where id = p_artist_profile_id
  returning * into a;

  if not found then
    raise exception 'Artist not found' using errcode = 'P0002';
  end if;

  perform public.write_audit_log(
    'website_publish'::public.audit_action,
    'artist_profile',
    a.id,
    jsonb_build_object(
      'website_published', a.website_published,
      'public_slug', a.public_slug,
      'featured', a.website_featured
    )
  );

  return a;
end;
$function$

-- admin_set_release_website: admin:website
CREATE OR REPLACE FUNCTION public.admin_set_release_website(p_release_id uuid, p_published boolean DEFAULT NULL::boolean, p_featured boolean DEFAULT NULL::boolean, p_slug text DEFAULT NULL::text, p_blurb text DEFAULT NULL::text, p_sort_order integer DEFAULT NULL::integer, p_playback_enabled boolean DEFAULT NULL::boolean, p_embed_spotify text DEFAULT NULL::text, p_embed_apple text DEFAULT NULL::text, p_embed_youtube text DEFAULT NULL::text)
 RETURNS releases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  r public.releases;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:website') then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  update public.releases set
    website_published = coalesce(p_published, website_published),
    website_featured = coalesce(p_featured, website_featured),
    website_slug = case
      when p_slug is null then website_slug
      when nullif(trim(p_slug), '') is null then null
      else lower(regexp_replace(trim(p_slug), '[^a-z0-9-]+', '-', 'gi'))
    end,
    website_blurb = coalesce(p_blurb, website_blurb),
    website_sort_order = coalesce(p_sort_order, website_sort_order),
    website_playback_enabled = coalesce(p_playback_enabled, website_playback_enabled),
    website_embed_spotify_url = coalesce(p_embed_spotify, website_embed_spotify_url),
    website_embed_apple_url = coalesce(p_embed_apple, website_embed_apple_url),
    website_embed_youtube_url = coalesce(p_embed_youtube, website_embed_youtube_url),
    website_published_at = case
      when coalesce(p_published, website_published) = true
        and website_published_at is null then now()
      when coalesce(p_published, website_published) = false then null
      else website_published_at
    end,
    updated_at = now()
  where id = r.id
  returning * into r;

  perform public.write_audit_log(
    case when r.website_published then 'website_publish'::public.audit_action
         else 'website_unpublish'::public.audit_action end,
    'release',
    r.id,
    jsonb_build_object(
      'website_published', r.website_published,
      'website_featured', r.website_featured,
      'website_slug', r.website_slug
    )
  );

  return r;
end;
$function$

-- admin_upsert_website_setting: admin:website
CREATE OR REPLACE FUNCTION public.admin_upsert_website_setting(p_key text, p_value jsonb)
 RETURNS website_settings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  row public.website_settings;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:website') then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  if p_key is null or length(trim(p_key)) < 1 then
    raise exception 'Invalid key' using errcode = '22023';
  end if;

  insert into public.website_settings (key, value, updated_by)
  values (trim(p_key), coalesce(p_value, '{}'::jsonb), actor)
  on conflict (key) do update set
    value = excluded.value,
    updated_by = actor,
    updated_at = now()
  returning * into row;

  perform public.write_audit_log(
    'website_publish'::public.audit_action,
    'website_settings',
    null,
    jsonb_build_object('key', row.key)
  );

  return row;
end;
$function$

-- admin_upsert_website_video: admin:website
CREATE OR REPLACE FUNCTION public.admin_upsert_website_video(p_id uuid DEFAULT NULL::uuid, p_title text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_thumbnail_url text DEFAULT NULL::text, p_artist_id uuid DEFAULT NULL::uuid, p_release_id uuid DEFAULT NULL::uuid, p_track_id uuid DEFAULT NULL::uuid, p_published boolean DEFAULT NULL::boolean, p_sort_order integer DEFAULT NULL::integer, p_delete boolean DEFAULT false)
 RETURNS website_videos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  row public.website_videos;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:website') then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  if p_delete and p_id is not null then
    delete from public.website_videos where id = p_id returning * into row;
    return row;
  end if;

  if p_id is null then
    if nullif(trim(coalesce(p_title, '')), '') is null or nullif(trim(coalesce(p_url, '')), '') is null then
      raise exception 'title and url required' using errcode = '22023';
    end if;
    insert into public.website_videos (
      title, url, thumbnail_url, artist_id, release_id, track_id, published, sort_order
    ) values (
      trim(p_title),
      trim(p_url),
      nullif(trim(coalesce(p_thumbnail_url, '')), ''),
      p_artist_id,
      p_release_id,
      p_track_id,
      coalesce(p_published, false),
      coalesce(p_sort_order, 0)
    )
    returning * into row;
  else
    update public.website_videos set
      title = coalesce(nullif(trim(p_title), ''), title),
      url = coalesce(nullif(trim(p_url), ''), url),
      thumbnail_url = case when p_thumbnail_url is null then thumbnail_url else nullif(trim(p_thumbnail_url), '') end,
      artist_id = coalesce(p_artist_id, artist_id),
      release_id = coalesce(p_release_id, release_id),
      track_id = coalesce(p_track_id, track_id),
      published = coalesce(p_published, published),
      sort_order = coalesce(p_sort_order, sort_order),
      updated_at = now()
    where id = p_id
    returning * into row;
    if not found then
      raise exception 'Video not found' using errcode = 'P0002';
    end if;
  end if;

  return row;
end;
$function$

-- apply_provider_sync_status: admin:distribution
CREATE OR REPLACE FUNCTION public.apply_provider_sync_status(p_job_id uuid, p_mapped_status text, p_provider_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  job public.distribution_jobs;
  run public.provider_sync_runs;
  target public.release_status;
  r public.releases;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:distribution') then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  if p_mapped_status is null or p_mapped_status not in (
    'delivering', 'delivered', 'live', 'failed', 'takedown_requested', 'taken_down'
  ) then
    raise exception 'Invalid mapped status for provider sync' using errcode = 'P0001';
  end if;

  target := p_mapped_status::public.release_status;

  select * into job from public.distribution_jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  perform set_config('nexo.trusted_status_transition', '1', true);
  begin
    r := public.transition_release_status(
      job.release_id,
      target,
      'Provider sync',
      jsonb_build_object(
        'source', 'apply_provider_sync_status',
        'provider_status', p_provider_status
      )
    );
  exception when others then
    perform set_config('nexo.trusted_status_transition', '0', true);
    raise;
  end;
  perform set_config('nexo.trusted_status_transition', '0', true);

  update public.distribution_jobs
  set status = case
        when target = 'delivered' then 'delivered'::public.distribution_job_status
        when target = 'live' then 'live'::public.distribution_job_status
        when target = 'failed' then 'failed'::public.distribution_job_status
        when target = 'taken_down' then 'taken_down'::public.distribution_job_status
        when target = 'takedown_requested' then 'takedown_requested'::public.distribution_job_status
        when target = 'delivering' then 'submitted'::public.distribution_job_status
        else status
      end,
      last_sync_at = now(),
      last_error = case when target = 'failed' then coalesce(last_error, 'Provider sync reported failed') else null end,
      updated_at = now()
  where id = job.id
  returning * into job;

  insert into public.provider_sync_runs (
    job_id, release_id, provider_name, trigger_source, status,
    provider_status, delivery_status, error_message, response_ref,
    created_by, finished_at
  ) values (
    job.id, job.release_id, job.provider_name, 'admin', 'succeeded',
    p_provider_status, p_mapped_status, null, null,
    actor,
    now()
  )
  returning * into run;

  perform public.write_audit_log(
    'distribution_sync'::public.audit_action,
    'release',
    job.release_id,
    jsonb_build_object('run_id', run.id, 'status', 'succeeded', 'mapped_status', p_mapped_status)
  );

  return jsonb_build_object(
    'job_id', job.id,
    'release_id', job.release_id,
    'release_status', r.status,
    'run_id', run.id,
    'mapped_status', p_mapped_status,
    'provider_status', p_provider_status
  );
end;
$function$

-- queue_approved_release: admin:distribution
CREATE OR REPLACE FUNCTION public.queue_approved_release(p_release_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS distribution_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  r public.releases;
  job public.distribution_jobs;
  provider_key text;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:distribution') then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if r.status not in ('approved', 'scheduled', 'failed') then
    raise exception 'Only approved/scheduled/failed releases can be queued (got %)', r.status
      using errcode = 'P0001';
  end if;

  if r.status in ('approved', 'failed') then
    perform set_config('nexo.trusted_status_transition', '1', true);
    begin
      perform public.transition_release_status(
        p_release_id,
        'scheduled',
        coalesce(p_notes, 'Queued for distribution'),
        jsonb_build_object('source', 'queue_approved_release')
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      raise;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);
  end if;

  provider_key := case
    when r.provider_name is null
      or btrim(r.provider_name) = ''
      or lower(btrim(r.provider_name)) = 'not_connected'
      then 'distribution_engine'
    else btrim(r.provider_name)
  end;

  insert into public.distribution_jobs (
    release_id, provider_name, status, created_by, metadata
  ) values (
    p_release_id,
    provider_key,
    'queued',
    actor,
    jsonb_build_object('notes', p_notes)
  )
  on conflict (release_id, provider_name) do update
    set status = case
          when public.distribution_jobs.status in ('delivered', 'live', 'taken_down')
            then public.distribution_jobs.status
          else 'queued'
        end,
        last_error = null,
        queued_at = now(),
        updated_at = now(),
        metadata = public.distribution_jobs.metadata || jsonb_build_object('requeued_at', now())
  returning * into job;

  perform public.write_audit_log(
    'distribution_queue'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object('job_id', job.id, 'notes', p_notes)
  );

  perform public.enqueue_distribution_email(
    p_release_id,
    'release_queued_for_distribution',
    jsonb_build_object('job_id', job.id, 'status', 'queued')
  );

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  values (
    r.owner_user_id,
    'distribution_update',
    'Release queued for distribution',
    'Your release was queued for Distribution Engine delivery.',
    'release',
    p_release_id
  );

  return job;
end;
$function$

-- begin_submit_queued_release: admin:distribution
CREATE OR REPLACE FUNCTION public.begin_submit_queued_release(p_job_id uuid, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  job public.distribution_jobs;
  existing public.provider_submissions;
  sub public.provider_submissions;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:distribution') then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key required' using errcode = 'P0001';
  end if;

  select * into job from public.distribution_jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  select * into existing
  from public.provider_submissions
  where provider_name = job.provider_name and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'idempotent', true,
      'submission_id', existing.id,
      'job_id', job.id,
      'status', existing.status,
      'provider_release_id', existing.provider_release_id
    );
  end if;

  if job.status not in ('queued', 'failed') then
    raise exception 'Job status % cannot be submitted', job.status using errcode = 'P0001';
  end if;

  update public.distribution_jobs
  set status = 'submitting', started_at = coalesce(started_at, now()), updated_at = now()
  where id = job.id
  returning * into job;

  insert into public.provider_submissions (
    job_id, release_id, provider_name, attempt_number, status, idempotency_key
  ) values (
    job.id,
    job.release_id,
    job.provider_name,
    job.retry_count + 1,
    'pending',
    p_idempotency_key
  )
  returning * into sub;

  return jsonb_build_object(
    'idempotent', false,
    'submission_id', sub.id,
    'job_id', job.id,
    'release_id', job.release_id,
    'provider_name', job.provider_name,
    'status', 'pending'
  );
end;
$function$

-- complete_submit_queued_release: admin:distribution
CREATE OR REPLACE FUNCTION public.complete_submit_queued_release(p_submission_id uuid, p_ok boolean, p_provider_release_id text DEFAULT NULL::text, p_response_ref text DEFAULT NULL::text, p_response_payload jsonb DEFAULT NULL::jsonb, p_error_code text DEFAULT NULL::text, p_error_message text DEFAULT NULL::text)
 RETURNS distribution_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  sub public.provider_submissions;
  job public.distribution_jobs;
begin
  if p_ok then
    -- Success finalize is service_role only (auth.uid() is null)
    if actor is not null then
      raise exception 'Service role only for successful submit finalize' using errcode = '42501';
    end if;
  else
    -- Failure path: staff JWT or service_role
    if actor is not null and not public.has_staff_permission(actor, 'admin:distribution') then
      raise exception 'Staff only' using errcode = '42501';
    end if;
  end if;

  select * into sub from public.provider_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  select * into job from public.distribution_jobs where id = sub.job_id for update;

  if p_ok then
    if p_provider_release_id is null or length(trim(p_provider_release_id)) = 0 then
      raise exception 'provider_release_id required on success' using errcode = 'P0001';
    end if;

    update public.provider_submissions
    set status = 'accepted',
        provider_release_id = p_provider_release_id,
        response_ref = p_response_ref,
        response_payload = coalesce(p_response_payload, '{}'::jsonb),
        completed_at = now()
    where id = sub.id;

    update public.distribution_jobs
    set status = 'submitted',
        provider_release_id = p_provider_release_id,
        response_ref = p_response_ref,
        submitted_at = now(),
        last_error = null,
        updated_at = now()
    where id = job.id
    returning * into job;

    perform set_config('nexo.internal_release_update', '1', true);
    update public.releases
    set provider_release_id = p_provider_release_id,
        provider_name = job.provider_name,
        provider_status = 'submitted',
        provider_connected = true,
        updated_at = now()
    where id = job.release_id;
    perform set_config('nexo.internal_release_update', '0', true);

    perform set_config('nexo.trusted_status_transition', '1', true);
    begin
      perform public.transition_release_status(
        job.release_id,
        'delivering',
        'Submitted to distribution provider',
        jsonb_build_object('source', 'complete_submit_queued_release', 'submission_id', sub.id)
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      -- leave job submitted; status transition may fail if already delivering
      null;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);

    perform public.enqueue_distribution_email(
      job.release_id,
      'release_distributing',
      jsonb_build_object('job_id', job.id)
    );

    -- write_audit_log requires auth.uid(); skip under service_role
    if actor is not null then
      perform public.write_audit_log(
        'distribution_submit'::public.audit_action,
        'release',
        job.release_id,
        jsonb_build_object('ok', true, 'submission_id', sub.id, 'provider_release_id', p_provider_release_id)
      );
    else
      insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
      values (
        null,
        'distribution_submit'::public.audit_action,
        'release',
        job.release_id,
        jsonb_build_object('ok', true, 'submission_id', sub.id, 'provider_release_id', p_provider_release_id, 'via', 'service_role')
          - 'password' - 'token' - 'access_token' - 'refresh_token' - 'service_role_key'
      );
    end if;
  else
    update public.provider_submissions
    set status = 'failed',
        error_code = coalesce(p_error_code, 'SUBMIT_FAILED'),
        error_message = p_error_message,
        response_payload = coalesce(p_response_payload, '{}'::jsonb),
        completed_at = now()
    where id = sub.id;

    update public.distribution_jobs
    set status = 'failed',
        retry_count = retry_count + 1,
        last_error = coalesce(p_error_message, p_error_code, 'Submit failed'),
        next_retry_at = now() + (interval '15 minutes' * least(retry_count + 1, 8)),
        updated_at = now()
    where id = job.id
    returning * into job;

    insert into public.distribution_retries (
      job_id, release_id, attempt_number, reason, outcome, error_message, created_by, finished_at
    ) values (
      job.id, job.release_id, job.retry_count,
      coalesce(p_error_code, 'submit_failed'),
      case when p_error_code = 'PROVIDER_NOT_CONNECTED' then 'unavailable' else 'failed' end,
      p_error_message,
      actor,
      now()
    );

    perform set_config('nexo.trusted_status_transition', '1', true);
    begin
      perform public.transition_release_status(
        job.release_id,
        'failed',
        coalesce(p_error_message, 'Distribution submit failed'),
        jsonb_build_object('source', 'complete_submit_queued_release', 'error_code', p_error_code)
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      null;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);

    perform public.enqueue_distribution_email(
      job.release_id,
      'release_distribution_failed',
      jsonb_build_object('job_id', job.id, 'error', p_error_message)
    );

    if actor is not null then
      perform public.write_audit_log(
        'distribution_submit'::public.audit_action,
        'release',
        job.release_id,
        jsonb_build_object('ok', false, 'submission_id', sub.id, 'error_code', p_error_code)
      );
    end if;
  end if;

  return job;
end;
$function$

-- record_provider_sync_run: admin:distribution
CREATE OR REPLACE FUNCTION public.record_provider_sync_run(p_job_id uuid, p_status text, p_provider_status text DEFAULT NULL::text, p_delivery_status text DEFAULT NULL::text, p_error_message text DEFAULT NULL::text, p_response_ref text DEFAULT NULL::text)
 RETURNS provider_sync_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  job public.distribution_jobs;
  run public.provider_sync_runs;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:distribution') then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  if p_status not in ('started', 'succeeded', 'failed', 'unavailable') then
    raise exception 'Invalid sync status' using errcode = 'P0001';
  end if;

  select * into job from public.distribution_jobs where id = p_job_id;
  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  insert into public.provider_sync_runs (
    job_id, release_id, provider_name, trigger_source, status,
    provider_status, delivery_status, error_message, response_ref,
    created_by, finished_at
  ) values (
    job.id, job.release_id, job.provider_name, 'admin', p_status,
    p_provider_status, p_delivery_status, p_error_message, p_response_ref,
    actor,
    case when p_status = 'started' then null else now() end
  )
  returning * into run;

  if p_status in ('succeeded', 'failed', 'unavailable') then
    update public.distribution_jobs
    set last_sync_at = now(),
        last_error = case when p_status = 'succeeded' then null else coalesce(p_error_message, last_error) end,
        updated_at = now()
    where id = job.id;
  end if;

  perform public.write_audit_log(
    'distribution_sync'::public.audit_action,
    'release',
    job.release_id,
    jsonb_build_object('run_id', run.id, 'status', p_status)
  );

  return run;
end;
$function$

-- reinstate_distribution_release: admin:distribution
CREATE OR REPLACE FUNCTION public.reinstate_distribution_release(p_release_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS releases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  r public.releases;
  target public.release_status;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:distribution') then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if r.status not in ('takedown_requested', 'taken_down') then
    raise exception 'Reinstate only from takedown states' using errcode = 'P0001';
  end if;

  target := case
    when r.provider_connected and r.provider_status in ('live', 'delivered') then 'live'
    when r.provider_connected then 'delivered'
    else 'approved'
  end;

  if r.status = 'taken_down' then
    perform set_config('nexo.internal_release_update', '1', true);
    insert into public.release_status_history (release_id, previous_status, new_status, actor_user_id, reason, metadata)
    values (r.id, r.status, target, actor, coalesce(p_reason, 'Reinstated'), jsonb_build_object('source', 'reinstate_distribution_release'));
    update public.releases set status = target, updated_at = now() where id = r.id returning * into r;
    perform set_config('nexo.internal_release_update', '0', true);
  else
    perform set_config('nexo.trusted_status_transition', '1', true);
    begin
      r := public.transition_release_status(
        p_release_id,
        case when target = 'approved' then 'live' else target end,
        coalesce(p_reason, 'Reinstated'),
        jsonb_build_object('source', 'reinstate_distribution_release')
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      raise;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);
  end if;

  update public.distribution_jobs
  set status = case when target in ('live', 'delivered') then target::text::public.distribution_job_status else 'queued' end,
      updated_at = now()
  where release_id = p_release_id;

  perform public.enqueue_distribution_email(
    p_release_id,
    'release_reinstated',
    jsonb_build_object('status', r.status)
  );

  perform public.write_audit_log(
    'distribution_reinstate'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object('reason', p_reason, 'new_status', r.status)
  );

  return r;
end;
$function$

-- request_distribution_takedown: admin:distribution
CREATE OR REPLACE FUNCTION public.request_distribution_takedown(p_release_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS releases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  r public.releases;
  staff boolean;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  staff := public.has_staff_permission(actor, 'admin:distribution');
  if not staff and r.owner_user_id <> actor then
    raise exception 'Not permitted' using errcode = '42501';
  end if;

  r := public.transition_release_status(
    p_release_id,
    'takedown_requested',
    coalesce(p_reason, 'Takedown requested'),
    jsonb_build_object('source', 'request_distribution_takedown')
  );

  update public.distribution_jobs
  set status = 'takedown_requested', updated_at = now()
  where release_id = p_release_id
    and status in ('queued', 'submitting', 'submitted', 'syncing', 'delivered', 'live', 'failed');

  perform public.enqueue_distribution_email(
    p_release_id,
    'release_takedown_requested',
    jsonb_build_object('reason', p_reason)
  );

  if staff then
    perform public.write_audit_log(
      'distribution_takedown'::public.audit_action,
      'release',
      p_release_id,
      jsonb_build_object('reason', p_reason)
    );
  else
    perform public.write_audit_log(
      'release_takedown_request'::public.audit_action,
      'release',
      p_release_id,
      jsonb_build_object('reason', p_reason)
    );
  end if;

  return r;
end;
$function$

-- claim_qc_item: admin:qc
CREATE OR REPLACE FUNCTION public.claim_qc_item(p_item_id uuid)
 RETURNS qc_queue_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  item public.qc_queue_items;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:qc') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into item from public.qc_queue_items where id = p_item_id for update;
  if not found then
    raise exception 'QC item not found' using errcode = 'P0002';
  end if;

  if item.assigned_to is not null and item.assigned_to <> actor and item.status in ('claimed', 'in_review') then
    raise exception 'QC item already claimed' using errcode = 'P0001';
  end if;

  update public.qc_queue_items
  set assigned_to = actor,
      assigned_at = coalesce(assigned_at, now()),
      claimed_at = now(),
      status = 'claimed',
      updated_at = now()
  where id = p_item_id
  returning * into item;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'qc_claim', 'qc_queue_item', item.id, jsonb_build_object('release_id', item.release_id));

  return item;
end;
$function$

-- release_qc_item: admin:qc
CREATE OR REPLACE FUNCTION public.release_qc_item(p_item_id uuid)
 RETURNS qc_queue_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  item public.qc_queue_items;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:qc') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into item from public.qc_queue_items where id = p_item_id for update;
  if not found then
    raise exception 'QC item not found' using errcode = 'P0002';
  end if;

  if item.assigned_to is distinct from actor
     and not public.has_role(actor, 'admin')
     and not public.has_role(actor, 'super_admin') then
    raise exception 'Only assignee or admin can release claim' using errcode = '42501';
  end if;

  update public.qc_queue_items
  set assigned_to = null,
      assigned_at = null,
      claimed_at = null,
      status = 'queued',
      updated_at = now()
  where id = p_item_id
  returning * into item;

  return item;
end;
$function$

-- set_qc_item_priority: admin:qc
CREATE OR REPLACE FUNCTION public.set_qc_item_priority(p_item_id uuid, p_priority qc_priority)
 RETURNS qc_queue_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  item public.qc_queue_items;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:qc') then
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
$function$

-- perform_qc_decision: admin:qc
CREATE OR REPLACE FUNCTION public.perform_qc_decision(p_release_id uuid, p_decision qc_decision, p_checklist jsonb DEFAULT '{}'::jsonb, p_artist_visible_reason text DEFAULT NULL::text, p_internal_note text DEFAULT NULL::text)
 RETURNS qc_reviews
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  r public.releases;
  new_status public.release_status;
  review public.qc_reviews;
  tmpl text;
  owner_rec record;
begin
  if actor is null or not (
    public.has_staff_permission(actor, 'admin:qc')
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
    if p_artist_visible_reason is null or length(trim(p_artist_visible_reason)) = 0 then
      raise exception 'Artist-visible reason required for request_changes' using errcode = 'P0001';
    end if;
  elsif p_decision = 'reject' then
    new_status := 'rejected';
    tmpl := 'RELEASE_REJECTED';
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

  select * into owner_rec from public._email_release_owner(p_release_id);
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
        'RELEASE_TITLE', coalesce(owner_rec.release_title, ''),
        'ARTIST_NAME', coalesce(owner_rec.artist_name, ''),
        'STATUS', new_status::text,
        'ARTIST_VISIBLE_REASON', coalesce(p_artist_visible_reason, ''),
        'RELEASE_ID', p_release_id::text,
        'CTA_URL', 'https://nexomusicdistro.space/dashboard/releases/' || p_release_id::text,
        'CTA_LABEL', 'View release'
      ),
      tmpl || ':' || p_release_id::text || ':' || new_status::text || ':' || review.id::text,
      actor
    );
  end if;

  return review;
end;
$function$

-- upsert_royalty_import_batch: admin:royalties
CREATE OR REPLACE FUNCTION public.upsert_royalty_import_batch(p_source_provider text, p_report_id text, p_period_start date DEFAULT NULL::date, p_period_end date DEFAULT NULL::date, p_currency character DEFAULT NULL::bpchar)
 RETURNS royalty_import_batches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  b public.royalty_import_batches;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:royalties') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.royalty_import_batches (
    source_provider, report_id, report_period_start, report_period_end, currency, created_by
  ) values (
    p_source_provider, p_report_id, p_period_start, p_period_end, p_currency, actor
  )
  on conflict (source_provider, report_id) do update
    set report_period_start = coalesce(excluded.report_period_start, royalty_import_batches.report_period_start),
        report_period_end = coalesce(excluded.report_period_end, royalty_import_batches.report_period_end),
        currency = coalesce(excluded.currency, royalty_import_batches.currency)
  returning * into b;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'royalty_import', 'royalty_import_batch', b.id,
          jsonb_build_object('source_provider', p_source_provider, 'report_id', p_report_id));
  return b;
end;
$function$

-- upsert_royalty_import_row: admin:royalties
CREATE OR REPLACE FUNCTION public.upsert_royalty_import_row(p_batch_id uuid, p_row_key text, p_raw jsonb, p_amount_minor bigint DEFAULT NULL::bigint, p_currency character DEFAULT NULL::bpchar, p_isrc text DEFAULT NULL::text, p_upc text DEFAULT NULL::text, p_territory character DEFAULT NULL::bpchar, p_dsp_code text DEFAULT NULL::text, p_period_start date DEFAULT NULL::date, p_period_end date DEFAULT NULL::date)
 RETURNS royalty_import_rows
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  b public.royalty_import_batches;
  r public.royalty_import_rows;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:royalties') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into b from public.royalty_import_batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found' using errcode = 'P0002'; end if;

  insert into public.royalty_import_rows (
    batch_id, source_provider, report_id, row_key, raw, amount_minor, currency,
    isrc, upc, territory, dsp_code, period_start, period_end
  ) values (
    b.id, b.source_provider, b.report_id, p_row_key, coalesce(p_raw, '{}'::jsonb),
    p_amount_minor, p_currency, p_isrc, p_upc, p_territory, p_dsp_code, p_period_start, p_period_end
  )
  on conflict (source_provider, report_id, row_key) do update
    set raw = excluded.raw,
        amount_minor = coalesce(excluded.amount_minor, royalty_import_rows.amount_minor),
        currency = coalesce(excluded.currency, royalty_import_rows.currency),
        isrc = coalesce(excluded.isrc, royalty_import_rows.isrc),
        upc = coalesce(excluded.upc, royalty_import_rows.upc),
        territory = coalesce(excluded.territory, royalty_import_rows.territory),
        dsp_code = coalesce(excluded.dsp_code, royalty_import_rows.dsp_code),
        period_start = coalesce(excluded.period_start, royalty_import_rows.period_start),
        period_end = coalesce(excluded.period_end, royalty_import_rows.period_end)
  where royalty_import_rows.match_status not in ('posted')
  returning * into r;

  if r is null then
    select * into r from public.royalty_import_rows
    where source_provider = b.source_provider and report_id = b.report_id and row_key = p_row_key;
  end if;

  update public.royalty_import_batches
  set row_count = (select count(*) from public.royalty_import_rows where batch_id = b.id)
  where id = b.id;

  return r;
end;
$function$

-- post_royalty_import_batch: admin:royalties
CREATE OR REPLACE FUNCTION public.post_royalty_import_batch(p_batch_id uuid)
 RETURNS royalty_import_batches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  b public.royalty_import_batches;
  r public.royalty_import_rows;
  match_count integer;
  matched_track_id uuid;
  matched_release_id uuid;
  matched_owner_id uuid;
  release_upc text;
  paid_access boolean;
  policy public.royalty_commission_policy;
  commission_bps_value integer;
  gross_value bigint;
  commission_value bigint;
  net_value bigint;
  acct_id uuid;
  entry_id uuid;
  normalized_isrc text;
  normalized_upc text;
begin
  if actor is null or not (
    public.has_staff_permission(actor, 'admin:royalties')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into b from public.royalty_import_batches
  where id = p_batch_id
  for update;
  if not found then
    raise exception 'Batch not found' using errcode = 'P0002';
  end if;

  select * into policy from public.royalty_commission_policy where id = 'default';
  if not found then
    raise exception 'Royalty commission policy missing' using errcode = 'P0001';
  end if;

  update public.royalty_import_batches
  set status = 'processing', error_summary = null
  where id = p_batch_id;

  for r in
    select * from public.royalty_import_rows
    where batch_id = p_batch_id and match_status <> 'posted'
    order by created_at, id
    for update
  loop
    matched_track_id := null;
    matched_release_id := null;
    matched_owner_id := null;
    release_upc := null;
    match_count := 0;
    entry_id := null;

    if r.amount_minor is null or r.amount_minor = 0 then
      update public.royalty_import_rows
      set match_status = 'conflict', conflict_reason = 'amount_missing_or_zero'
      where id = r.id;
      continue;
    end if;
    if r.currency is null or r.currency !~ '^[A-Z]{3}$' then
      update public.royalty_import_rows
      set match_status = 'conflict', conflict_reason = 'currency_missing_or_invalid'
      where id = r.id;
      continue;
    end if;

    normalized_isrc := upper(regexp_replace(coalesce(r.isrc, ''), '[^A-Z0-9]', '', 'g'));
    normalized_upc := regexp_replace(coalesce(r.upc, ''), '[^0-9]', '', 'g');

    if normalized_isrc <> '' then
      select count(*), min(rt.id), min(rel.id), min(rel.owner_user_id), min(rel.upc)
      into match_count, matched_track_id, matched_release_id, matched_owner_id, release_upc
      from public.release_tracks rt
      join public.releases rel on rel.id = rt.release_id
      where upper(regexp_replace(coalesce(rt.isrc, ''), '[^A-Z0-9]', '', 'g')) = normalized_isrc;

      if match_count > 1 then
        update public.royalty_import_rows
        set match_status = 'conflict', conflict_reason = 'duplicate_isrc_match'
        where id = r.id;
        continue;
      end if;
    end if;

    if matched_release_id is not null and normalized_upc <> '' then
      if regexp_replace(coalesce(release_upc, ''), '[^0-9]', '', 'g') <> normalized_upc then
        update public.royalty_import_rows
        set match_status = 'conflict', conflict_reason = 'isrc_upc_mismatch'
        where id = r.id;
        continue;
      end if;
    end if;

    if matched_release_id is null and normalized_upc <> '' then
      select count(*), min(rel.id), min(rel.owner_user_id)
      into match_count, matched_release_id, matched_owner_id
      from public.releases rel
      where regexp_replace(coalesce(rel.upc, ''), '[^0-9]', '', 'g') = normalized_upc;

      if match_count > 1 then
        update public.royalty_import_rows
        set match_status = 'conflict', conflict_reason = 'duplicate_upc_match'
        where id = r.id;
        continue;
      end if;
    end if;

    if matched_release_id is null or matched_owner_id is null then
      update public.royalty_import_rows
      set match_status = 'unmatched', conflict_reason = 'no_catalog_match'
      where id = r.id;
      continue;
    end if;

    paid_access :=
      exists (
        select 1 from public.billing_entitlement_overrides o
        where o.user_id = matched_owner_id
          and o.status in ('active','trialing')
          and (o.ends_at is null or o.ends_at > now())
          and o.plan_id in ('artist_pro','label_starter','label_pro')
      )
      or exists (
        select 1 from public.billing_subscriptions s
        where s.user_id = matched_owner_id
          and s.status in ('active','trialing')
          and s.plan_id in ('artist_pro','label_starter','label_pro')
      );

    commission_bps_value := case
      when paid_access then policy.paid_plan_bps
      else policy.free_plan_bps
    end;

    gross_value := r.amount_minor;
    commission_value := round((gross_value::numeric * commission_bps_value::numeric) / 10000)::bigint;
    net_value := gross_value - commission_value;

    if net_value = 0 then
      update public.royalty_import_rows
      set match_status = 'conflict',
          conflict_reason = 'owner_net_zero',
          release_id = matched_release_id,
          track_id = matched_track_id,
          owner_user_id = matched_owner_id,
          gross_amount_minor = gross_value,
          commission_bps = commission_bps_value,
          commission_minor = commission_value,
          owner_net_minor = net_value
      where id = r.id;
      continue;
    end if;

    insert into public.ledger_accounts (owner_user_id, currency, label)
    values (matched_owner_id, upper(r.currency), 'default')
    on conflict (owner_user_id, currency, label) do nothing;

    select id into acct_id from public.ledger_accounts
    where owner_user_id = matched_owner_id
      and currency = upper(r.currency)
      and label = 'default';

    insert into public.ledger_entries (
      account_id,
      owner_user_id,
      kind,
      amount_minor,
      currency,
      description,
      created_by,
      gross_minor,
      net_minor,
      fee_minor,
      source_provider,
      source_report_id,
      source_row_key,
      period_start,
      period_end,
      release_id,
      track_id,
      isrc,
      upc,
      territory,
      dsp_code,
      balance_bucket,
      import_row_id,
      metadata
    ) values (
      acct_id,
      matched_owner_id,
      case when net_value > 0 then 'royalty_credit'::public.money_entry_kind else 'royalty_debit'::public.money_entry_kind end,
      net_value,
      upper(r.currency),
      'Royalty import ' || r.source_provider || ' / ' || r.report_id,
      actor,
      gross_value,
      net_value,
      commission_value,
      r.source_provider,
      r.report_id,
      r.row_key,
      r.period_start,
      r.period_end,
      matched_release_id,
      matched_track_id,
      nullif(r.isrc, ''),
      nullif(r.upc, ''),
      r.territory,
      r.dsp_code,
      'available',
      r.id,
      jsonb_build_object(
        'commission_bps', commission_bps_value,
        'nexo_commission_minor', commission_value,
        'paid_access', paid_access
      )
    )
    on conflict (source_provider, source_report_id, source_row_key)
      where source_provider is not null and source_report_id is not null and source_row_key is not null
    do nothing
    returning id into entry_id;

    if entry_id is null then
      select id into entry_id from public.ledger_entries
      where source_provider = r.source_provider
        and source_report_id = r.report_id
        and source_row_key = r.row_key;
    end if;

    update public.royalty_import_rows
    set
      match_status = 'posted',
      conflict_reason = null,
      release_id = matched_release_id,
      track_id = matched_track_id,
      owner_user_id = matched_owner_id,
      posted_ledger_entry_id = entry_id,
      gross_amount_minor = gross_value,
      commission_bps = commission_bps_value,
      commission_minor = commission_value,
      owner_net_minor = net_value
    where id = r.id;
  end loop;

  update public.royalty_import_batches
  set
    row_count = (select count(*) from public.royalty_import_rows where batch_id = p_batch_id),
    matched_count = (select count(*) from public.royalty_import_rows where batch_id = p_batch_id and match_status in ('matched','posted')),
    conflict_count = (select count(*) from public.royalty_import_rows where batch_id = p_batch_id and match_status = 'conflict'),
    posted_count = (select count(*) from public.royalty_import_rows where batch_id = p_batch_id and match_status = 'posted'),
    status = case
      when exists (select 1 from public.royalty_import_rows where batch_id = p_batch_id and match_status in ('conflict','unmatched'))
        then 'partial'::public.royalty_import_status
      else 'completed'::public.royalty_import_status
    end,
    completed_at = now()
  where id = p_batch_id
  returning * into b;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'royalty_import',
    'royalty_import_batch',
    b.id,
    jsonb_build_object(
      'operation', 'post',
      'rows', b.row_count,
      'posted', b.posted_count,
      'conflicts', b.conflict_count
    )
  );

  return b;
end;
$function$

-- publish_royalty_statement: admin:statements
CREATE OR REPLACE FUNCTION public.publish_royalty_statement(p_owner_user_id uuid, p_period_start date, p_period_end date, p_currency character)
 RETURNS royalty_statements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  stmt public.royalty_statements;
  opening bigint := 0;
  earnings bigint := 0;
  deductions bigint := 0;
  adjustments bigint := 0;
  payouts_sum bigint := 0;
  closing bigint := 0;
begin
  if actor is null or not (
    public.has_staff_permission(actor, 'admin:statements')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select coalesce(sum(amount_minor), 0) into opening
  from public.ledger_entries
  where owner_user_id = p_owner_user_id and currency = upper(p_currency)
    and created_at::date < p_period_start;

  select coalesce(sum(amount_minor) filter (where kind in ('royalty_credit', 'royalty_debit')), 0),
         coalesce(sum(amount_minor) filter (where kind in ('deduction', 'fee')), 0),
         coalesce(sum(amount_minor) filter (where kind in ('adjustment', 'reversal', 'refund')), 0),
         coalesce(sum(amount_minor) filter (where kind = 'payout'), 0)
  into earnings, deductions, adjustments, payouts_sum
  from public.ledger_entries
  where owner_user_id = p_owner_user_id and currency = upper(p_currency)
    and (
      (period_start is not null and period_start >= p_period_start and coalesce(period_end, period_start) <= p_period_end)
      or (period_start is null and created_at::date between p_period_start and p_period_end)
    );

  closing := opening + earnings + deductions + adjustments + payouts_sum;

  insert into public.royalty_statements (
    owner_user_id, period_start, period_end, currency, status,
    opening_minor, earnings_minor, deductions_minor, adjustments_minor,
    payouts_minor, closing_minor, total_minor, published_at
  ) values (
    p_owner_user_id, p_period_start, p_period_end, upper(p_currency), 'published',
    opening, earnings, deductions, adjustments, payouts_sum, closing, closing, now()
  ) returning * into stmt;

  insert into public.royalty_line_items (
    statement_id, description, amount_minor, currency, kind, ledger_entry_id,
    release_id, track_id, dsp_code, territory, isrc, upc
  )
  select stmt.id,
         coalesce(le.description, le.kind::text),
         le.amount_minor, le.currency, le.kind, le.id, le.release_id, le.track_id,
         le.dsp_code, le.territory, le.isrc, le.upc
  from public.ledger_entries le
  where le.owner_user_id = p_owner_user_id and le.currency = upper(p_currency)
    and (
      (le.period_start is not null and le.period_start >= p_period_start and coalesce(le.period_end, le.period_start) <= p_period_end)
      or (le.period_start is null and le.created_at::date between p_period_start and p_period_end)
    );

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'statement_publish', 'royalty_statement', stmt.id,
          jsonb_build_object('period_start', p_period_start, 'period_end', p_period_end, 'currency', upper(p_currency)));

  insert into public.email_outbound_events (
    to_email, template_key, payload, status, related_entity_type, related_entity_id
  )
  select pr.email, 'royalty_statement_published',
         jsonb_build_object('statement_id', stmt.id),
         'pending', 'royalty_statement', stmt.id
  from public.profiles pr where pr.id = p_owner_user_id and pr.email is not null;

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  values (
    p_owner_user_id, 'royalty_statement', 'Royalty statement published',
    'A royalty statement is available for ' || p_period_start::text || ' – ' || p_period_end::text,
    'royalty_statement', stmt.id
  );

  return stmt;
end;
$function$

-- create_payout_request: admin:payouts
CREATE OR REPLACE FUNCTION public.create_payout_request(p_owner_user_id uuid, p_amount_minor bigint, p_currency character, p_method text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS payouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  elig jsonb;
  existing public.payouts;
  created public.payouts;
  acct_id uuid;
begin
  if actor is null or not (
    public.has_staff_permission(actor, 'admin:payouts')
    or actor = p_owner_user_id
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'amount_minor must be positive integer' using errcode = 'P0001';
  end if;
  if p_currency is null or length(trim(p_currency)) <> 3 then
    raise exception 'ISO currency required' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select * into existing from public.payouts
    where owner_user_id = p_owner_user_id and idempotency_key = p_idempotency_key;
    if found then return existing; end if;
  end if;

  -- Lock owner rows conceptually via advisory lock
  perform pg_advisory_xact_lock(hashtext(p_owner_user_id::text || ':' || upper(p_currency)));

  elig := public.payout_eligibility(p_owner_user_id, upper(p_currency), p_amount_minor);
  if not (elig->>'eligible')::boolean then
    raise exception 'Payout not eligible: %', elig->>'reason' using errcode = 'P0001';
  end if;

  insert into public.ledger_accounts (owner_user_id, currency, label)
  values (p_owner_user_id, upper(p_currency), 'default')
  on conflict (owner_user_id, currency, label) do nothing;
  select id into acct_id from public.ledger_accounts
  where owner_user_id = p_owner_user_id and currency = upper(p_currency) and label = 'default';

  insert into public.payouts (
    owner_user_id, amount_minor, currency, status, method, idempotency_key,
    created_by, ledger_account_id, eligibility_notes, min_threshold_minor
  ) values (
    p_owner_user_id, p_amount_minor, upper(p_currency), 'pending', p_method, p_idempotency_key,
    actor, acct_id, elig::text, (elig->>'threshold_minor')::bigint
  ) returning * into created;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor, 'payout_create', 'payout', created.id,
    jsonb_build_object('amount_minor', p_amount_minor, 'currency', upper(p_currency))
  );

  insert into public.email_outbound_events (to_email, template_key, payload, status, related_entity_type, related_entity_id)
  select p.email, 'payout_requested', jsonb_build_object('payout_id', created.id, 'amount_minor', p_amount_minor, 'currency', upper(p_currency)),
         'pending', 'payout', created.id
  from public.profiles p where p.id = p_owner_user_id and p.email is not null;

  return created;
end;
$function$

-- transition_payout_status: admin:payouts
CREATE OR REPLACE FUNCTION public.transition_payout_status(p_payout_id uuid, p_new_status payout_status, p_reason text DEFAULT NULL::text)
 RETURNS payouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  p public.payouts;
  allowed boolean := false;
begin
  if actor is null or not (
    public.has_staff_permission(actor, 'admin:payouts')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into p from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'Payout not found' using errcode = 'P0002'; end if;
  if p_new_status = 'paid' then
    raise exception 'PAID requires a real payment operation' using errcode = '42501';
  end if;

  allowed := case p.status
    when 'pending' then p_new_status in ('under_review', 'approved', 'cancelled', 'on_hold', 'rejected')
    when 'under_review' then p_new_status in ('approved', 'rejected', 'cancelled', 'on_hold', 'pending')
    when 'approved' then p_new_status in ('processing', 'cancelled', 'on_hold', 'rejected')
    when 'processing' then p_new_status in ('failed', 'on_hold', 'rejected')
    when 'on_hold' then p_new_status in ('pending', 'under_review', 'approved', 'cancelled', 'rejected')
    when 'failed' then p_new_status in ('pending', 'cancelled', 'under_review')
    when 'rejected' then p_new_status in ('pending')
    else false
  end;
  if not allowed then
    raise exception 'Invalid payout transition from % to %', p.status, p_new_status
      using errcode = 'P0001';
  end if;

  update public.payouts
  set status = p_new_status,
      updated_at = now(),
      rejected_reason = case when p_new_status = 'rejected' then coalesce(p_reason, rejected_reason) else rejected_reason end,
      reviewed_by = case when p_new_status in ('under_review', 'approved', 'rejected') then actor else reviewed_by end,
      reviewed_at = case when p_new_status in ('under_review', 'approved', 'rejected') then now() else reviewed_at end,
      failure_reason = case when p_new_status = 'failed' then coalesce(p_reason, failure_reason) else failure_reason end
  where id = p_payout_id returning * into p;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor, 'payout_status_change', 'payout', p.id,
    jsonb_build_object('status', p_new_status::text, 'reason', coalesce(p_reason, ''))
  );
  return p;
end;
$function$

-- complete_payout_paid: admin:payouts
CREATE OR REPLACE FUNCTION public.complete_payout_paid(p_payout_id uuid, p_payment_reference text, p_provider_name text DEFAULT NULL::text, p_provider_payout_id text DEFAULT NULL::text)
 RETURNS payouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  p public.payouts;
  acct_id uuid;
  provider text := nullif(trim(coalesce(p_provider_name, '')), '');
begin
  -- Staff JWT or service_role. Ordinary authenticated users remain forbidden.
  if actor is not null and not (
    public.has_staff_permission(actor, 'admin:payouts')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_payment_reference is null or length(trim(p_payment_reference)) = 0 then
    raise exception 'payment_reference required' using errcode = 'P0001';
  end if;
  if provider is null or lower(provider) in ('not_connected', 'none', 'null') then
    raise exception 'PAID requires authorized provider path (provider_name)' using errcode = '42501';
  end if;

  select * into p from public.payouts where id = p_payout_id for update;
  if not found then
    raise exception 'Payout not found' using errcode = 'P0002';
  end if;

  -- Idempotent: a retry after a committed PAID operation must not add another ledger row/email.
  if p.status = 'paid' then
    return p;
  end if;
  if p.status <> 'processing' then
    raise exception 'PAID only from PROCESSING (current=%)', p.status using errcode = 'P0001';
  end if;

  perform set_config('nexo.trusted_financial_transition', '1', true);
  begin
    update public.payouts
    set status = 'paid',
        payment_reference = trim(p_payment_reference),
        paid_at = now(),
        provider_name = provider,
        provider_payout_id = coalesce(nullif(trim(p_provider_payout_id), ''), provider_payout_id),
        updated_at = now()
    where id = p_payout_id
    returning * into p;
  exception when others then
    perform set_config('nexo.trusted_financial_transition', '0', true);
    raise;
  end;
  perform set_config('nexo.trusted_financial_transition', '0', true);

  insert into public.ledger_accounts (owner_user_id, currency, label)
  values (p.owner_user_id, p.currency, 'default')
  on conflict (owner_user_id, currency, label) do nothing;

  select id into acct_id
  from public.ledger_accounts
  where owner_user_id = p.owner_user_id
    and currency = p.currency
    and label = 'default';

  insert into public.ledger_entries (
    account_id, owner_user_id, kind, amount_minor, currency, description,
    reference_type, reference_id, created_by, balance_bucket, payout_id,
    net_minor, gross_minor
  ) values (
    acct_id, p.owner_user_id, 'payout', -p.amount_minor, p.currency,
    'Payout ' || p.id::text, 'payout', p.id, actor, 'paid', p.id,
    -p.amount_minor, -p.amount_minor
  );

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'payout_payment_op',
    'payout',
    p.id,
    jsonb_build_object(
      'payment_reference', p.payment_reference,
      'provider_name', p.provider_name,
      'provider_payout_id', p.provider_payout_id,
      'via', case when actor is null then 'service_role' else 'staff' end
    )
  );

  insert into public.email_outbound_events (
    to_email, template_key, payload, status, related_entity_type, related_entity_id
  )
  select
    pr.email,
    'payout_paid',
    jsonb_build_object(
      'payout_id', p.id,
      'payment_reference', p.payment_reference
    ),
    'pending',
    'payout',
    p.id
  from public.profiles pr
  where pr.id = p.owner_user_id
    and pr.email is not null;

  return p;
end;
$function$

-- set_payout_compliance_hold: admin:compliance
CREATE OR REPLACE FUNCTION public.set_payout_compliance_hold(p_owner_user_id uuid, p_reason text, p_case_id uuid DEFAULT NULL::uuid, p_active boolean DEFAULT true)
 RETURNS payout_compliance_holds
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  h public.payout_compliance_holds;
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:compliance') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_active then
    insert into public.payout_compliance_holds (owner_user_id, case_id, reason, active, created_by)
    values (p_owner_user_id, p_case_id, p_reason, true, actor)
    returning * into h;
  else
    update public.payout_compliance_holds
    set active = false, released_at = now(), released_by = actor
    where owner_user_id = p_owner_user_id and active = true
    returning * into h;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'compliance_payout_hold', 'payout_compliance_hold', h.id,
          jsonb_build_object('active', p_active, 'owner', p_owner_user_id, 'reason', p_reason));
  return h;
end;
$function$

-- publish_notification_broadcast: admin:notifications
CREATE OR REPLACE FUNCTION public.publish_notification_broadcast(p_title text, p_body text, p_audience text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor uuid := auth.uid();
  v_id uuid;
  v_count integer := 0;
  v_title text := btrim(coalesce(p_title,''));
  v_body text := btrim(coalesce(p_body,''));
  v_audience text := lower(btrim(coalesce(p_audience,'all')));
begin
  if actor is null or not public.has_staff_permission(actor, 'admin:notifications') then
    raise exception 'Administrator permission required' using errcode='42501';
  end if;
  if char_length(v_title) < 2 or char_length(v_title) > 160 then
    raise exception 'Title must be 2-160 characters' using errcode='22023';
  end if;
  if char_length(v_body) < 2 or char_length(v_body) > 20000 then
    raise exception 'Body must be 2-20000 characters' using errcode='22023';
  end if;
  if v_audience not in ('all','artists','labels') then
    raise exception 'Invalid broadcast audience' using errcode='22023';
  end if;

  insert into public.notification_broadcasts(title,body,audience,created_by)
  values(v_title,v_body,v_audience,actor)
  returning id into v_id;

  insert into public.notifications(user_id,type,title,body,entity_type,entity_id)
  select p.id,'broadcast'::public.notification_type,v_title,v_body,'notification_broadcast',v_id
  from public.profiles p
  where p.account_type in ('artist','label')
    and p.account_status in ('active','pending_verification')
    and (
      v_audience='all'
      or (v_audience='artists' and p.account_type='artist')
      or (v_audience='labels' and p.account_type='label')
    );

  get diagnostics v_count = row_count;

  update public.notification_broadcasts
  set recipient_count=v_count, published_at=now()
  where id=v_id;

  return jsonb_build_object('id',v_id,'recipient_count',v_count);
end;
$function$

-- list_owner_ddex_status: admin:ddex
CREATE OR REPLACE FUNCTION public.list_owner_ddex_status(p_release_id uuid)
 RETURNS TABLE(message_id text, message_subtype text, validation_status text, delivery_status text, package_status text, ern_version text, created_at timestamp with time zone, acknowledged_at timestamp with time zone, target_name text, target_is_test boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    m.message_id,
    m.message_subtype,
    m.validation_status,
    m.delivery_status,
    m.package_status,
    m.ern_version,
    m.created_at,
    m.acknowledged_at,
    t.display_name,
    coalesce(t.is_test, false)
  from public.ddex_messages m
  join public.releases r on r.id = m.release_id
  left join public.dsp_targets t on t.id = m.target_id
  where m.release_id = p_release_id
    and (
      r.owner_user_id = auth.uid()
      or public.has_staff_permission(auth.uid(), 'admin:ddex')
    )
  order by m.created_at desc
  limit 50;
$function$
