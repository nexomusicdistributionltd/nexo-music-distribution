-- NEXO fanlink automatic LIVE queue. Resolver calls remain server-side.
create table if not exists public.fanlink_sync_jobs (
 id uuid primary key default gen_random_uuid(),
 release_id uuid not null references public.releases(id) on delete cascade,
 status text not null default 'queued' check(status in ('queued','processing','done','failed')),
 attempts integer not null default 0,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(release_id)
);
alter table public.fanlink_sync_jobs enable row level security;
drop policy if exists "fanlink_sync_jobs_staff_read" on public.fanlink_sync_jobs;
create policy "fanlink_sync_jobs_staff_read" on public.fanlink_sync_jobs for select to authenticated using(public.is_staff(auth.uid()));

create or replace function public.queue_fanlink_on_live() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status is distinct from old.status and new.status <> 'live' then
   update public.fanlinks set is_published=false where release_id=new.id;
 end if;
 if new.status='live' and old.status is distinct from new.status then
   insert into public.fanlink_sync_jobs(release_id,status,attempts,last_error,updated_at)
   values(new.id,'queued',0,null,now())
   on conflict(release_id) do update set status='queued',last_error=null,updated_at=now();
 end if;
 return new;
end;$;
revoke all on function public.queue_fanlink_on_live() from public,anon,authenticated;
drop trigger if exists trg_queue_fanlink_on_live on public.releases;
create trigger trg_queue_fanlink_on_live after update of status on public.releases for each row execute function public.queue_fanlink_on_live();
