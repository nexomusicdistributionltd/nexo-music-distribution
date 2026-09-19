-- Keep internal/provider delivery problems in the admin delivery queue instead
-- of changing the artist/label-facing release status to Failed/Declined.
--
-- The distribution job still records the real failed attempt and remains retryable.
-- Only artist-correctable validation failures should change the release workflow.

create or replace function public.is_internal_distribution_error(
  p_error_code text,
  p_error_message text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    coalesce(p_error_code,'') = 'PROVIDER_NOT_CONNECTED'
    or lower(coalesce(p_error_message,'')) like '%distribution engine authorization%'
    or lower(coalesce(p_error_message,'')) like '%delivery target has been disabled for this release%'
    or lower(coalesce(p_error_message,'')) like '%please enter the store or additional store%'
    or (
      lower(coalesce(p_error_message,'')) like '%tiktokstarttime%'
      and lower(coalesce(p_error_message,'')) like '%does not match the format%'
    )
    or (
      lower(coalesce(p_error_message,'')) like '%even%'
      and (
        lower(coalesce(p_error_message,'')) like '%not connected%'
        or lower(coalesce(p_error_message,'')) like '%connect an even account%'
      )
    );
$$;

create or replace function public.complete_submit_queued_release(
  p_submission_id uuid,
  p_ok boolean,
  p_provider_release_id text default null::text,
  p_response_ref text default null::text,
  p_response_payload jsonb default null::jsonb,
  p_error_code text default null::text,
  p_error_message text default null::text
)
returns distribution_jobs
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor uuid := auth.uid();
  sub public.provider_submissions;
  job public.distribution_jobs;
  internal_issue boolean := false;
begin
  if p_ok then
    if actor is not null then
      raise exception 'Service role only for successful submit finalize' using errcode = '42501';
    end if;
  else
    if actor is not null and not public.is_staff(actor) then
      raise exception 'Staff only' using errcode = '42501';
    end if;
  end if;

  select * into sub
  from public.provider_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  select * into job
  from public.distribution_jobs
  where id = sub.job_id
  for update;

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
        updated_at = now(),
        metadata = coalesce(metadata,'{}'::jsonb)
          - 'internal_ops_issue'
          - 'internal_ops_error_code'
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
        jsonb_build_object(
          'source', 'complete_submit_queued_release',
          'submission_id', sub.id
        )
      );
    exception when others then
      perform set_config('nexo.trusted_status_transition', '0', true);
      null;
    end;
    perform set_config('nexo.trusted_status_transition', '0', true);

    perform public.enqueue_distribution_email(
      job.release_id,
      'release_distributing',
      jsonb_build_object('job_id', job.id)
    );

    if actor is not null then
      perform public.write_audit_log(
        'distribution_submit'::public.audit_action,
        'release',
        job.release_id,
        jsonb_build_object(
          'ok', true,
          'submission_id', sub.id,
          'provider_release_id', p_provider_release_id
        )
      );
    else
      insert into public.audit_logs (
        actor_user_id, action, entity_type, entity_id, metadata
      ) values (
        null,
        'distribution_submit'::public.audit_action,
        'release',
        job.release_id,
        jsonb_build_object(
          'ok', true,
          'submission_id', sub.id,
          'provider_release_id', p_provider_release_id,
          'via', 'service_role'
        ) - 'password' - 'token' - 'access_token' - 'refresh_token' - 'service_role_key'
      );
    end if;
  else
    internal_issue := public.is_internal_distribution_error(
      p_error_code,
      p_error_message
    );

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
        updated_at = now(),
        metadata = coalesce(metadata,'{}'::jsonb) || case
          when internal_issue then jsonb_build_object(
            'internal_ops_issue', true,
            'internal_ops_error_code', coalesce(p_error_code,'SUBMIT_FAILED'),
            'artist_action_required', false
          )
          else jsonb_build_object(
            'internal_ops_issue', false,
            'artist_action_required', true
          )
        end
    where id = job.id
    returning * into job;

    insert into public.distribution_retries (
      job_id,
      release_id,
      attempt_number,
      reason,
      outcome,
      error_message,
      created_by,
      finished_at
    ) values (
      job.id,
      job.release_id,
      job.retry_count,
      coalesce(p_error_code, 'submit_failed'),
      case
        when p_error_code = 'PROVIDER_NOT_CONNECTED' then 'unavailable'
        else 'failed'
      end,
      p_error_message,
      actor,
      now()
    );

    -- Important: for internal/provider problems, keep the release at its
    -- existing approved/queued state. Only the distribution job is Failed.
    if not internal_issue then
      perform set_config('nexo.trusted_status_transition', '1', true);
      begin
        perform public.transition_release_status(
          job.release_id,
          'failed',
          coalesce(p_error_message, 'Distribution submit failed'),
          jsonb_build_object(
            'source', 'complete_submit_queued_release',
            'error_code', p_error_code
          )
        );
      exception when others then
        perform set_config('nexo.trusted_status_transition', '0', true);
        null;
      end;
      perform set_config('nexo.trusted_status_transition', '0', true);

      perform public.enqueue_distribution_email(
        job.release_id,
        'release_distribution_failed',
        jsonb_build_object(
          'job_id', job.id,
          'error', p_error_message
        )
      );
    else
      insert into public.audit_logs (
        actor_user_id, action, entity_type, entity_id, metadata
      ) values (
        actor,
        'distribution_submit'::public.audit_action,
        'release',
        job.release_id,
        jsonb_build_object(
          'ok', false,
          'internal_ops_issue', true,
          'artist_action_required', false,
          'submission_id', sub.id,
          'error_code', p_error_code,
          'error', p_error_message
        )
      );
    end if;

    if actor is not null and not internal_issue then
      perform public.write_audit_log(
        'distribution_submit'::public.audit_action,
        'release',
        job.release_id,
        jsonb_build_object(
          'ok', false,
          'submission_id', sub.id,
          'error_code', p_error_code
        )
      );
    end if;
  end if;

  return job;
end;
$function$;

comment on function public.is_internal_distribution_error(text,text) is
  'Classifies provider/account/routing/format failures that Nexo must handle internally and must not expose as artist corrections.';

comment on function public.complete_submit_queued_release(uuid,boolean,text,text,jsonb,text,text) is
  'Finalizes provider submission. Internal provider failures remain in the admin delivery queue without changing the artist-facing release status or sending artist failure mail.';
