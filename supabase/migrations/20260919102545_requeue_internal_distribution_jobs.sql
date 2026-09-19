-- Internal/provider delivery problems must stay visible in the admin Queue so
-- an administrator can retry submission without returning the release to the
-- artist/label.
--
-- The real provider error remains recorded in last_error/metadata. This only
-- changes the admin work-queue state from failed back to queued for errors that
-- have already been classified as internal operations issues.

create or replace function public.requeue_internal_distribution_job()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'failed'
     and lower(coalesce(new.metadata->>'internal_ops_issue','false')) = 'true'
  then
    update public.distribution_jobs
    set status = 'queued',
        next_retry_at = null,
        queued_at = now(),
        updated_at = now(),
        metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'provider_retry_required', true,
          'artist_action_required', false,
          'requeued_from_internal_failure_at', now()
        )
    where id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists distribution_jobs_requeue_internal_failure
  on public.distribution_jobs;

create trigger distribution_jobs_requeue_internal_failure
after update of status, metadata
on public.distribution_jobs
for each row
when (
  new.status = 'failed'
  and lower(coalesce(new.metadata->>'internal_ops_issue','false')) = 'true'
)
execute function public.requeue_internal_distribution_job();

comment on function public.requeue_internal_distribution_job() is
  'Keeps internal/provider delivery failures visible in the admin Queue by automatically returning the distribution job to queued while preserving the provider error for operations.';
