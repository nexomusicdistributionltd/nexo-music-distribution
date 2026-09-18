-- NEXO fanlink hardening + analytics. Safe after 20260918081000/82000.
alter table public.fanlinks add column if not exists is_published boolean not null default true;
create unique index if not exists fanlinks_release_unique_idx on public.fanlinks(release_id) where release_id is not null;

create table if not exists public.fanlink_events (
 id bigint generated always as identity primary key,
 fanlink_id uuid not null references public.fanlinks(id) on delete cascade,
 event_type text not null check (event_type in ('view','platform_click','preview_play')),
 platform text,
 created_at timestamptz not null default now()
);
alter table public.fanlink_events enable row level security;
drop policy if exists "fanlink_events_public_insert" on public.fanlink_events;
create policy "fanlink_events_public_insert" on public.fanlink_events for insert to anon,authenticated with check (true);
drop policy if exists "fanlink_events_owner_read" on public.fanlink_events;
create policy "fanlink_events_owner_read" on public.fanlink_events for select to authenticated using (
 exists(select 1 from public.fanlinks f where f.id=fanlink_id and (f.owner_user_id=auth.uid() or public.is_staff(auth.uid())))
);
grant insert on public.fanlink_events to anon,authenticated;
grant select on public.fanlink_events to authenticated;
