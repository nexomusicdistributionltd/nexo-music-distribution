-- Reconcile distribution queue provider identity with the private Distribution Engine.
alter table public.distribution_jobs
  alter column provider_name set default 'distribution_engine';

update public.distribution_jobs
set provider_name = 'distribution_engine',
    updated_at = now()
where provider_name = 'not_connected'
  and not exists (
    select 1
    from public.distribution_jobs other
    where other.release_id = public.distribution_jobs.release_id
      and other.provider_name = 'distribution_engine'
      and other.id <> public.distribution_jobs.id
  );

update public.provider_submissions s
set provider_name = j.provider_name
from public.distribution_jobs j
where s.job_id = j.id
  and s.provider_name is distinct from j.provider_name;

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
  provider_key text;
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
$$;

revoke all on function public.queue_approved_release(uuid, text) from public;
grant execute on function public.queue_approved_release(uuid, text) to authenticated;
