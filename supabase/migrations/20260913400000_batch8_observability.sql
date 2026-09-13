-- Batch 8: minimal observability + health counters (additive, no financial data changes)
-- Never delete financial/history data.

create table if not exists public.app_health_counters (
  key text primary key,
  value bigint not null default 0 check (value >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.app_health_counters is
  'Lightweight operational counters for Batch 8 observability. Not a metrics SaaS replacement.';

create table if not exists public.app_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('started', 'succeeded', 'failed', 'skipped_unavailable')),
  attempt int not null default 1 check (attempt >= 1),
  idempotency_key text,
  error_code text,
  meta jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create unique index if not exists app_job_runs_idempotency_uidx
  on public.app_job_runs (job_name, idempotency_key)
  where idempotency_key is not null;

create index if not exists app_job_runs_started_idx
  on public.app_job_runs (started_at desc);

comment on table public.app_job_runs is
  'Idempotent/retry-safe job run log. status skipped_unavailable for truthful unconfigured integrations.';

alter table public.app_health_counters enable row level security;
alter table public.app_job_runs enable row level security;

-- Staff read; service role writes (no anon/authenticated writes)
drop policy if exists "app_health_counters_staff_select" on public.app_health_counters;
create policy "app_health_counters_staff_select" on public.app_health_counters
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "app_job_runs_staff_select" on public.app_job_runs;
create policy "app_job_runs_staff_select" on public.app_job_runs
  for select to authenticated
  using (public.is_staff(auth.uid()));

-- Increment counter (SECURITY DEFINER, locked search_path, staff or service)
create or replace function public.bump_health_counter(p_key text, p_by bigint default 1)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v bigint;
begin
  if auth.role() is distinct from 'service_role' and not public.is_staff(auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_key is null or length(trim(p_key)) = 0 or length(p_key) > 120 then
    raise exception 'invalid key';
  end if;
  if p_by is null or p_by = 0 then
    raise exception 'invalid increment';
  end if;
  insert into public.app_health_counters as c (key, value, updated_at)
  values (trim(p_key), greatest(p_by, 0), now())
  on conflict (key) do update
    set value = public.app_health_counters.value + excluded.value,
        updated_at = now()
  returning c.value into v;
  return v;
end;
$$;

revoke all on function public.bump_health_counter(text, bigint) from public;
grant execute on function public.bump_health_counter(text, bigint) to authenticated, service_role;

create or replace function public.record_job_run(
  p_job_name text,
  p_status text,
  p_idempotency_key text default null,
  p_error_code text default null,
  p_meta jsonb default '{}'::jsonb,
  p_attempt int default 1
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' and not public.is_staff(auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_job_name is null or length(trim(p_job_name)) = 0 then
    raise exception 'invalid job_name';
  end if;
  if p_status not in ('started', 'succeeded', 'failed', 'skipped_unavailable') then
    raise exception 'invalid status';
  end if;

  if p_idempotency_key is not null then
    select id into v_id
    from public.app_job_runs
    where job_name = trim(p_job_name)
      and idempotency_key = p_idempotency_key
    limit 1;
    if v_id is not null then
      return v_id; -- idempotent
    end if;
  end if;

  insert into public.app_job_runs (
    job_name, status, attempt, idempotency_key, error_code, meta,
    finished_at
  ) values (
    trim(p_job_name),
    p_status,
    greatest(coalesce(p_attempt, 1), 1),
    p_idempotency_key,
    p_error_code,
    coalesce(p_meta, '{}'::jsonb),
    case when p_status = 'started' then null else now() end
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_job_run(text, text, text, text, jsonb, int) from public;
grant execute on function public.record_job_run(text, text, text, text, jsonb, int) to authenticated, service_role;
