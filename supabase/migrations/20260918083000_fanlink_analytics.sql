-- NEXO fanlink publication + server-recorded analytics.
alter table public.fanlinks add column if not exists is_published boolean not null default false;
create unique index if not exists fanlinks_release_unique_idx on public.fanlinks(release_id);
create table if not exists public.fanlink_events (
 id bigint generated always as identity primary key,
 fanlink_id uuid not null references public.fanlinks(id) on delete cascade,
 event_type text not null check (event_type in ('view','platform_click','preview_play')),
 platform text,
 created_at timestamptz not null default now()
);
alter table public.fanlink_events enable row level security;
drop policy if exists "fanlink_events_public_insert" on public.fanlink_events;
revoke insert on public.fanlink_events from anon,authenticated;
drop policy if exists "fanlink_events_owner_read" on public.fanlink_events;
create policy "fanlink_events_owner_read" on public.fanlink_events for select to authenticated using (
 exists(select 1 from public.fanlinks f where f.id=fanlink_id and (f.owner_user_id=auth.uid() or public.is_staff(auth.uid())))
);
grant select on public.fanlink_events to authenticated;
create index if not exists fanlink_events_fanlink_created_idx on public.fanlink_events(fanlink_id,created_at desc);
create index if not exists fanlink_events_platform_idx on public.fanlink_events(platform) where platform is not null;
