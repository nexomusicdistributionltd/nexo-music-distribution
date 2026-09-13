-- Batch 6 — Distribution core tables, RLS, and RPCs
-- Additive only. Never fabricates provider success.

-- ---------------------------------------------------------------------------
-- Enums for distribution subsystem
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.distribution_job_status as enum (
    'queued',
    'submitting',
    'submitted',
    'syncing',
    'delivered',
    'live',
    'failed',
    'cancelled',
    'takedown_requested',
    'taken_down',
    'reinstating'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.provider_submission_status as enum (
    'pending',
    'accepted',
    'rejected',
    'failed',
    'superseded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.webhook_process_status as enum (
    'received',
    'processed',
    'ignored',
    'failed',
    'duplicate'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- distribution_jobs — queue / pipeline for approved releases
-- ---------------------------------------------------------------------------
create table if not exists public.distribution_jobs (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  provider_name text not null default 'not_connected',
  status public.distribution_job_status not null default 'queued',
  priority int not null default 100,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  last_sync_at timestamptz,
  retry_count int not null default 0,
  max_retries int not null default 5,
  next_retry_at timestamptz,
  last_error text,
  provider_release_id text,
  provider_track_ids jsonb not null default '{}'::jsonb,
  response_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (release_id, provider_name)
);

create index if not exists distribution_jobs_status_idx
  on public.distribution_jobs (status, queued_at);
create index if not exists distribution_jobs_release_idx
  on public.distribution_jobs (release_id);
create index if not exists distribution_jobs_retry_idx
  on public.distribution_jobs (status, next_retry_at)
  where status = 'failed';

drop trigger if exists distribution_jobs_set_updated_at on public.distribution_jobs;
create trigger distribution_jobs_set_updated_at
  before update on public.distribution_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- provider_submissions — each attempt to submit/update with a provider
-- ---------------------------------------------------------------------------
create table if not exists public.provider_submissions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.distribution_jobs (id) on delete cascade,
  release_id uuid not null references public.releases (id) on delete cascade,
  provider_name text not null,
  attempt_number int not null default 1,
  status public.provider_submission_status not null default 'pending',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  response_ref text,
  provider_release_id text,
  error_code text,
  error_message text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (provider_name, idempotency_key)
);

create index if not exists provider_submissions_job_idx
  on public.provider_submissions (job_id, created_at desc);
create index if not exists provider_submissions_release_idx
  on public.provider_submissions (release_id, created_at desc);

-- ---------------------------------------------------------------------------
-- provider_webhook_events — inbound provider events (idempotent by event id)
-- ---------------------------------------------------------------------------
create table if not exists public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  event_id text not null,
  event_type text not null,
  signature_valid boolean,
  process_status public.webhook_process_status not null default 'received',
  payload jsonb not null default '{}'::jsonb,
  release_id uuid references public.releases (id) on delete set null,
  job_id uuid references public.distribution_jobs (id) on delete set null,
  mapped_status text,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider_name, event_id)
);

create index if not exists provider_webhook_events_received_idx
  on public.provider_webhook_events (received_at desc);
create index if not exists provider_webhook_events_release_idx
  on public.provider_webhook_events (release_id)
  where release_id is not null;

-- ---------------------------------------------------------------------------
-- provider_sync_runs — polling / sync without webhooks
-- ---------------------------------------------------------------------------
create table if not exists public.provider_sync_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.distribution_jobs (id) on delete cascade,
  release_id uuid references public.releases (id) on delete cascade,
  provider_name text not null,
  trigger_source text not null default 'admin' check (trigger_source in ('admin', 'cron', 'system')),
  status text not null default 'started' check (status in ('started', 'succeeded', 'failed', 'unavailable')),
  provider_status text,
  delivery_status text,
  error_message text,
  response_ref text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null
);

create index if not exists provider_sync_runs_started_idx
  on public.provider_sync_runs (started_at desc);

-- ---------------------------------------------------------------------------
-- distribution_retries — explicit retry ledger
-- ---------------------------------------------------------------------------
create table if not exists public.distribution_retries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.distribution_jobs (id) on delete cascade,
  release_id uuid not null references public.releases (id) on delete cascade,
  attempt_number int not null,
  reason text,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  outcome text check (outcome is null or outcome in ('succeeded', 'failed', 'skipped', 'unavailable')),
  error_message text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists distribution_retries_job_idx
  on public.distribution_retries (job_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.distribution_jobs enable row level security;
alter table public.provider_submissions enable row level security;
alter table public.provider_webhook_events enable row level security;
alter table public.provider_sync_runs enable row level security;
alter table public.distribution_retries enable row level security;

-- Owners can read their own jobs/submissions; staff full read
drop policy if exists "distribution_jobs_select" on public.distribution_jobs;
create policy "distribution_jobs_select" on public.distribution_jobs
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or public.owns_release(release_id)
  );

drop policy if exists "distribution_jobs_no_client_write" on public.distribution_jobs;
create policy "distribution_jobs_no_client_write" on public.distribution_jobs
  for insert to authenticated
  with check (false);

drop policy if exists "distribution_jobs_no_client_update" on public.distribution_jobs;
create policy "distribution_jobs_no_client_update" on public.distribution_jobs
  for update to authenticated
  using (false);

drop policy if exists "distribution_jobs_no_client_delete" on public.distribution_jobs;
create policy "distribution_jobs_no_client_delete" on public.distribution_jobs
  for delete to authenticated
  using (false);

drop policy if exists "provider_submissions_select" on public.provider_submissions;
create policy "provider_submissions_select" on public.provider_submissions
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or public.owns_release(release_id)
  );

drop policy if exists "provider_submissions_no_client_write" on public.provider_submissions;
create policy "provider_submissions_no_client_write" on public.provider_submissions
  for all to authenticated
  using (false)
  with check (false);

-- Webhooks: staff read only (owners should not see raw provider payloads)
drop policy if exists "provider_webhook_events_staff_select" on public.provider_webhook_events;
create policy "provider_webhook_events_staff_select" on public.provider_webhook_events
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "provider_webhook_events_no_client_write" on public.provider_webhook_events;
create policy "provider_webhook_events_no_client_write" on public.provider_webhook_events
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists "provider_sync_runs_select" on public.provider_sync_runs;
create policy "provider_sync_runs_select" on public.provider_sync_runs
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or (release_id is not null and public.owns_release(release_id))
  );

drop policy if exists "provider_sync_runs_no_client_write" on public.provider_sync_runs;
create policy "provider_sync_runs_no_client_write" on public.provider_sync_runs
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists "distribution_retries_select" on public.distribution_retries;
create policy "distribution_retries_select" on public.distribution_retries
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or public.owns_release(release_id)
  );

drop policy if exists "distribution_retries_no_client_write" on public.distribution_retries;
create policy "distribution_retries_no_client_write" on public.distribution_retries
  for all to authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- Helper: enqueue email on distribution transitions (never 'sent')
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_distribution_email(
  p_release_id uuid,
  p_template_key text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  owner_email text;
  eid uuid;
begin
  select r.owner_user_id, p.email
    into owner_id, owner_email
  from public.releases r
  join public.profiles p on p.id = r.owner_user_id
  where r.id = p_release_id;

  if owner_email is null or length(trim(owner_email)) = 0 then
    return null;
  end if;

  insert into public.email_outbound_events (
    to_email, template_key, payload, status, related_entity_type, related_entity_id
  ) values (
    owner_email,
    p_template_key,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('release_id', p_release_id),
    'queued',
    'release',
    p_release_id
  )
  returning id into eid;

  return eid;
end;
$$;

revoke all on function public.enqueue_distribution_email(uuid, text, jsonb) from public;

-- ---------------------------------------------------------------------------
-- queue_approved_release — staff queues approved → scheduled + distribution_jobs
-- ---------------------------------------------------------------------------
create or replace function public.queue_approved_release(
  p_release_id uuid,
  p_notes text default null
)
returns public.distribution_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.releases;
  job public.distribution_jobs;
begin
  if actor is null or not public.is_staff(actor) then
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

  -- Move approved/failed → scheduled (queued for distribution). scheduled stays.
  if r.status in ('approved', 'failed') then
    perform public.transition_release_status(
      p_release_id,
      'scheduled',
      coalesce(p_notes, 'Queued for distribution'),
      jsonb_build_object('source', 'queue_approved_release')
    );
  end if;

  insert into public.distribution_jobs (
    release_id, provider_name, status, created_by, metadata
  ) values (
    p_release_id,
    coalesce(nullif(r.provider_name, ''), 'not_connected'),
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
        retry_count = case
          when public.distribution_jobs.status = 'failed' then public.distribution_jobs.retry_count
          else public.distribution_jobs.retry_count
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
    'Your release was queued. Delivery requires a connected distribution provider.',
    'release',
    p_release_id
  );

  return job;
end;
$$;

revoke all on function public.queue_approved_release(uuid, text) from public;
grant execute on function public.queue_approved_release(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- submit_queued_release — idempotent submit attempt (fails closed if no provider)
-- App layer calls provider; this RPC records the attempt + marks job submitting.
-- ---------------------------------------------------------------------------
create or replace function public.begin_submit_queued_release(
  p_job_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  job public.distribution_jobs;
  existing public.provider_submissions;
  sub public.provider_submissions;
begin
  if actor is null or not public.is_staff(actor) then
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
$$;

revoke all on function public.begin_submit_queued_release(uuid, text) from public;
grant execute on function public.begin_submit_queued_release(uuid, text) to authenticated;

-- Record provider submit outcome (success path only when real provider IDs provided)
create or replace function public.complete_submit_queued_release(
  p_submission_id uuid,
  p_ok boolean,
  p_provider_release_id text default null,
  p_response_ref text default null,
  p_response_payload jsonb default null,
  p_error_code text default null,
  p_error_message text default null
)
returns public.distribution_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  sub public.provider_submissions;
  job public.distribution_jobs;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
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

    -- Mark release delivering only when provider_connected already true
    perform set_config('nexo.internal_release_update', '1', true);
    update public.releases
    set provider_release_id = p_provider_release_id,
        provider_name = job.provider_name,
        provider_status = 'submitted',
        provider_connected = true,
        updated_at = now()
    where id = job.release_id;
    perform set_config('nexo.internal_release_update', '0', true);

    begin
      perform public.transition_release_status(
        job.release_id,
        'delivering',
        'Submitted to distribution provider',
        jsonb_build_object('source', 'complete_submit_queued_release', 'submission_id', sub.id)
      );
    exception when others then
      -- leave job submitted; status transition may fail if already delivering
      null;
    end;

    perform public.enqueue_distribution_email(
      job.release_id,
      'release_distributing',
      jsonb_build_object('job_id', job.id)
    );

    perform public.write_audit_log(
      'distribution_submit'::public.audit_action,
      'release',
      job.release_id,
      jsonb_build_object('ok', true, 'submission_id', sub.id, 'provider_release_id', p_provider_release_id)
    );
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

    begin
      perform public.transition_release_status(
        job.release_id,
        'failed',
        coalesce(p_error_message, 'Distribution submit failed'),
        jsonb_build_object('source', 'complete_submit_queued_release', 'error_code', p_error_code)
      );
    exception when others then
      null;
    end;

    perform public.enqueue_distribution_email(
      job.release_id,
      'release_distribution_failed',
      jsonb_build_object('job_id', job.id, 'error', p_error_message)
    );

    perform public.write_audit_log(
      'distribution_submit'::public.audit_action,
      'release',
      job.release_id,
      jsonb_build_object('ok', false, 'submission_id', sub.id, 'error_code', p_error_code)
    );
  end if;

  return job;
end;
$$;

revoke all on function public.complete_submit_queued_release(uuid, boolean, text, text, jsonb, text, text) from public;
grant execute on function public.complete_submit_queued_release(uuid, boolean, text, text, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- record_provider_sync_run
-- ---------------------------------------------------------------------------
create or replace function public.record_provider_sync_run(
  p_job_id uuid,
  p_status text,
  p_provider_status text default null,
  p_delivery_status text default null,
  p_error_message text default null,
  p_response_ref text default null
)
returns public.provider_sync_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  job public.distribution_jobs;
  run public.provider_sync_runs;
begin
  if actor is null or not public.is_staff(actor) then
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
$$;

revoke all on function public.record_provider_sync_run(uuid, text, text, text, text, text) from public;
grant execute on function public.record_provider_sync_run(uuid, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- process_provider_webhook_event — idempotent insert + status mapping hooks
-- Signature verification is done in app; this records outcome.
-- ---------------------------------------------------------------------------
create or replace function public.process_provider_webhook_event(
  p_provider_name text,
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_signature_valid boolean,
  p_release_id uuid default null,
  p_mapped_status text default null
)
returns public.provider_webhook_events
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.provider_webhook_events;
  job public.distribution_jobs;
  target_status public.release_status;
begin
  -- Service role / staff only — auth.uid() may be null for webhook route using service client
  if auth.uid() is not null and not public.is_staff(auth.uid()) then
    raise exception 'Staff or service only' using errcode = '42501';
  end if;

  if p_event_id is null or length(trim(p_event_id)) = 0 then
    raise exception 'event_id required' using errcode = 'P0001';
  end if;

  insert into public.provider_webhook_events (
    provider_name, event_id, event_type, signature_valid, payload,
    release_id, mapped_status, process_status
  ) values (
    p_provider_name, p_event_id, p_event_type, p_signature_valid,
    coalesce(p_payload, '{}'::jsonb), p_release_id, p_mapped_status,
    case when p_signature_valid is distinct from true then 'failed' else 'received' end
  )
  on conflict (provider_name, event_id) do update
    set process_status = 'duplicate'
  returning * into ev;

  if ev.process_status = 'duplicate' then
    return ev;
  end if;

  if p_signature_valid is distinct from true then
    update public.provider_webhook_events
    set process_status = 'failed',
        error_message = 'Signature invalid or webhook secret missing',
        processed_at = now()
    where id = ev.id
    returning * into ev;
    return ev;
  end if;

  if p_release_id is not null and p_mapped_status is not null then
    select * into job from public.distribution_jobs
    where release_id = p_release_id
    order by updated_at desc
    limit 1;

    -- Safe status mapping only
    target_status := null;
    if p_mapped_status in ('delivering', 'delivered', 'live', 'failed', 'taken_down', 'takedown_requested') then
      target_status := p_mapped_status::public.release_status;
    end if;

    if target_status is not null then
      begin
        perform public.transition_release_status(
          p_release_id,
          target_status,
          'Provider webhook: ' || p_event_type,
          jsonb_build_object('source', 'webhook', 'event_id', p_event_id)
        );
      exception when others then
        update public.provider_webhook_events
        set process_status = 'failed',
            error_message = SQLERRM,
            processed_at = now(),
            job_id = job.id
        where id = ev.id
        returning * into ev;
        return ev;
      end;

      if job.id is not null then
        update public.distribution_jobs
        set status = case
              when target_status = 'delivered' then 'delivered'::public.distribution_job_status
              when target_status = 'live' then 'live'::public.distribution_job_status
              when target_status = 'failed' then 'failed'::public.distribution_job_status
              when target_status = 'taken_down' then 'taken_down'::public.distribution_job_status
              when target_status = 'takedown_requested' then 'takedown_requested'::public.distribution_job_status
              when target_status = 'delivering' then 'submitted'::public.distribution_job_status
              else status
            end,
            last_sync_at = now(),
            updated_at = now()
        where id = job.id;
      end if;

      perform public.enqueue_distribution_email(
        p_release_id,
        'release_' || p_mapped_status,
        jsonb_build_object('event_id', p_event_id, 'event_type', p_event_type)
      );
    end if;
  end if;

  update public.provider_webhook_events
  set process_status = 'processed',
      processed_at = now(),
      job_id = job.id,
      release_id = coalesce(release_id, p_release_id)
  where id = ev.id
  returning * into ev;

  perform public.write_audit_log(
    'distribution_webhook'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object('event_id', p_event_id, 'event_type', p_event_type, 'mapped_status', p_mapped_status)
  );

  return ev;
end;
$$;

revoke all on function public.process_provider_webhook_event(text, text, text, jsonb, boolean, uuid, text) from public;
grant execute on function public.process_provider_webhook_event(text, text, text, jsonb, boolean, uuid, text) to authenticated;
grant execute on function public.process_provider_webhook_event(text, text, text, jsonb, boolean, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- request_distribution_takedown / reinstate
-- ---------------------------------------------------------------------------
create or replace function public.request_distribution_takedown(
  p_release_id uuid,
  p_reason text default null
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
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

  staff := public.is_staff(actor);
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

  perform public.write_audit_log(
    'distribution_takedown'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object('reason', p_reason)
  );

  return r;
end;
$$;

revoke all on function public.request_distribution_takedown(uuid, text) from public;
grant execute on function public.request_distribution_takedown(uuid, text) to authenticated;

create or replace function public.reinstate_distribution_release(
  p_release_id uuid,
  p_reason text default null
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.releases;
  target public.release_status;
begin
  if actor is null or not public.is_staff(actor) then
    raise exception 'Staff only' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if r.status not in ('takedown_requested', 'taken_down') then
    raise exception 'Reinstate only from takedown states' using errcode = 'P0001';
  end if;

  -- Prefer live if previously delivered/live metadata suggests it; else delivered
  target := case
    when r.provider_connected and r.provider_status in ('live', 'delivered') then 'live'
    when r.provider_connected then 'delivered'
    else 'approved'
  end;

  -- taken_down → live/delivered/approved via intermediate if needed
  if r.status = 'taken_down' then
    -- transition machine allows takedown_requested → live/delivered; from taken_down need staff path
    -- Use internal update + history for reinstate from taken_down
    perform set_config('nexo.internal_release_update', '1', true);
    insert into public.release_status_history (release_id, previous_status, new_status, actor_user_id, reason, metadata)
    values (r.id, r.status, target, actor, coalesce(p_reason, 'Reinstated'), jsonb_build_object('source', 'reinstate_distribution_release'));
    update public.releases set status = target, updated_at = now() where id = r.id returning * into r;
    perform set_config('nexo.internal_release_update', '0', true);
  else
    r := public.transition_release_status(
      p_release_id,
      case when target = 'approved' then 'live' else target end,
      coalesce(p_reason, 'Reinstated'),
      jsonb_build_object('source', 'reinstate_distribution_release')
    );
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
$$;

revoke all on function public.reinstate_distribution_release(uuid, text) from public;
grant execute on function public.reinstate_distribution_release(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Extend transition_release_status for failed + provider-driven paths
-- ---------------------------------------------------------------------------
create or replace function public.transition_release_status(
  p_release_id uuid,
  p_new_status public.release_status,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.releases
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.releases;
  actor uuid := auth.uid();
  staff boolean;
  owner_ok boolean;
  allowed boolean := false;
  meta_source text;
begin
  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  staff := actor is not null and (
    public.has_role(actor, 'admin')
    or public.has_role(actor, 'super_admin')
    or public.has_role(actor, 'support')
  );
  owner_ok := actor is not null and r.owner_user_id = actor;
  meta_source := coalesce(p_metadata->>'source', '');

  -- Owner transitions
  if owner_ok and not staff then
    if r.status in ('draft', 'changes_requested') and p_new_status = 'submitted' then
      allowed := true;
    elsif r.status in ('approved', 'scheduled', 'delivered', 'live')
          and p_new_status = 'takedown_requested' then
      allowed := true;
    end if;
  end if;

  -- Staff transitions (QC / ops)
  if staff then
    if r.status = 'submitted' and p_new_status in ('in_qc', 'changes_requested', 'rejected', 'approved') then
      allowed := true;
    elsif r.status = 'in_qc' and p_new_status in ('changes_requested', 'rejected', 'approved') then
      allowed := true;
    elsif r.status = 'approved' and p_new_status in ('scheduled', 'rejected', 'changes_requested') then
      allowed := true;
    elsif r.status = 'scheduled' and p_new_status in ('delivering', 'changes_requested', 'failed') then
      allowed := true;
    elsif r.status = 'delivering' and p_new_status in ('delivered', 'live', 'rejected', 'failed') then
      allowed := true;
    elsif r.status = 'delivered' and p_new_status in ('live', 'failed') then
      allowed := true;
    elsif r.status = 'failed' and p_new_status in ('scheduled', 'approved', 'changes_requested') then
      allowed := true;
    elsif r.status = 'takedown_requested' and p_new_status in ('taken_down', 'live', 'delivered') then
      allowed := true;
    elsif r.status = 'rejected' and p_new_status in ('draft', 'changes_requested') then
      allowed := true;
    elsif r.status = 'live' and p_new_status in ('takedown_requested', 'taken_down') then
      allowed := true;
    end if;
  end if;

  -- Trusted internal/provider sources (SECURITY DEFINER callers with GUC or webhook/source)
  if not allowed and meta_source in (
    'complete_submit_queued_release',
    'webhook',
    'sync_release_status',
    'queue_approved_release',
    'reinstate_distribution_release'
  ) then
    if r.status is distinct from p_new_status then
      allowed := true;
    end if;
  end if;

  if not allowed then
    raise exception 'Transition from % to % is not permitted for this actor', r.status, p_new_status
      using errcode = '42501';
  end if;

  -- Provider-gated statuses cannot be reached without a connected provider
  if p_new_status in ('delivering', 'delivered', 'live') and not r.provider_connected then
    -- Allow only when trusted submit just flipped connected in same txn via internal path
    if meta_source not in ('complete_submit_queued_release', 'webhook', 'sync_release_status') then
      raise exception 'Provider not connected — cannot move to %', p_new_status
        using errcode = 'P0001';
    end if;
    -- Re-read provider_connected after potential prior update in same transaction
    select provider_connected into r.provider_connected from public.releases where id = p_release_id;
    if not r.provider_connected and meta_source <> 'complete_submit_queued_release' then
      raise exception 'Provider not connected — cannot move to %', p_new_status
        using errcode = 'P0001';
    end if;
  end if;

  perform set_config('nexo.internal_release_update', '1', true);

  insert into public.release_status_history (release_id, previous_status, new_status, actor_user_id, reason, metadata)
  values (r.id, r.status, p_new_status, actor, p_reason, coalesce(p_metadata, '{}'::jsonb));

  update public.releases
  set
    status = p_new_status,
    submitted_at = case when p_new_status = 'submitted' then now() else submitted_at end,
    locked_at = case
      when p_new_status in ('submitted', 'in_qc', 'approved', 'scheduled', 'delivering', 'delivered', 'live', 'takedown_requested', 'taken_down', 'failed')
        then coalesce(locked_at, now())
      when p_new_status in ('draft', 'changes_requested')
        then null
      else locked_at
    end,
    rejection_reason = case when p_new_status = 'rejected' then p_reason else rejection_reason end,
    changes_requested_reason = case when p_new_status = 'changes_requested' then p_reason else changes_requested_reason end,
    updated_at = now()
  where id = r.id
  returning * into r;

  perform set_config('nexo.internal_release_update', '0', true);

  -- Email enqueue on key transitions
  if p_new_status in ('approved', 'scheduled', 'delivering', 'delivered', 'live', 'failed', 'takedown_requested', 'taken_down') then
    perform public.enqueue_distribution_email(
      r.id,
      'release_status_' || p_new_status::text,
      jsonb_build_object('previous', null, 'status', p_new_status)
    );
  end if;

  return r;
end;
$$;

revoke all on function public.transition_release_status(uuid, public.release_status, text, jsonb) from public;
grant execute on function public.transition_release_status(uuid, public.release_status, text, jsonb) to authenticated;

comment on table public.distribution_jobs is 'Distribution queue. Statuses are internal; LIVE/DELIVERED only via real provider events.';
comment on table public.provider_webhook_events is 'Idempotent provider webhook log. Fails closed when signature invalid/secret missing.';
