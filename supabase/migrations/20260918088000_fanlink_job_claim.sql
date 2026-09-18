-- Atomically claim fanlink jobs to prevent duplicate workers.
create or replace function public.claim_fanlink_sync_jobs(p_limit integer default 10)
returns setof public.fanlink_sync_jobs
language plpgsql
security definer
set search_path=public
as $$
begin
  return query
  with picked as (
    select id
    from public.fanlink_sync_jobs
    where status='queued'
    order by created_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,10),50))
  )
  update public.fanlink_sync_jobs j
     set status='processing',
         attempts=j.attempts+1,
         updated_at=now()
    from picked
   where j.id=picked.id
  returning j.*;
end;$$;
revoke all on function public.claim_fanlink_sync_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_fanlink_sync_jobs(integer) to service_role;
create index if not exists fanlink_sync_jobs_status_created_idx on public.fanlink_sync_jobs(status,created_at);
