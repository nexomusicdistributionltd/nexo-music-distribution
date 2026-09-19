create or replace function public.begin_submit_queued_release(
  p_job_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor uuid := auth.uid();
  job public.distribution_jobs;
  existing public.provider_submissions;
  sub public.provider_submissions;
  effective_key text := nullif(btrim(p_idempotency_key), '');
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  if effective_key is null then
    raise exception 'idempotency_key required' using errcode = 'P0001';
  end if;

  select * into job
  from public.distribution_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  select * into existing
  from public.provider_submissions
  where provider_name = job.provider_name
    and idempotency_key = effective_key;

  if found and existing.status in ('pending', 'accepted') then
    return jsonb_build_object(
      'idempotent', true,
      'submission_id', existing.id,
      'job_id', job.id,
      'status', existing.status,
      'provider_release_id', existing.provider_release_id
    );
  end if;

  if found then
    effective_key := effective_key || ':retry:' || gen_random_uuid()::text;
  end if;

  if job.status not in ('queued', 'failed') then
    raise exception 'Job status % cannot be submitted', job.status using errcode = 'P0001';
  end if;

  update public.distribution_jobs
  set status = 'submitting',
      started_at = coalesce(started_at, now()),
      last_error = null,
      updated_at = now()
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
    effective_key
  )
  returning * into sub;

  return jsonb_build_object(
    'idempotent', false,
    'submission_id', sub.id,
    'job_id', job.id,
    'release_id', job.release_id,
    'provider_name', job.provider_name,
    'status', 'pending',
    'idempotency_key', effective_key
  );
end;
$function$;
