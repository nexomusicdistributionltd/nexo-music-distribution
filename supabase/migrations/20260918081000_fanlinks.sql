-- NEXO fanlinks: Nexo-owned public links; upstream resolver identities stay server-side.
create table if not exists public.fanlinks (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references public.profiles(id) on delete cascade,
 release_id uuid references public.releases(id) on delete cascade,
 slug text not null unique,
 title text not null,
 artist_name text not null,
 isrc text,
 artwork_url text,
 platform_links jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.fanlinks enable row level security;
create policy "fanlinks_public_read" on public.fanlinks for select using (true);
create policy "fanlinks_owner_insert" on public.fanlinks for insert to authenticated with check(owner_user_id=auth.uid());
create policy "fanlinks_owner_update" on public.fanlinks for update to authenticated using(owner_user_id=auth.uid() or public.is_staff(auth.uid())) with check(owner_user_id=auth.uid() or public.is_staff(auth.uid()));
create policy "fanlinks_owner_delete" on public.fanlinks for delete to authenticated using(owner_user_id=auth.uid() or public.is_staff(auth.uid()));
grant select on public.fanlinks to anon, authenticated;
grant insert,update,delete on public.fanlinks to authenticated;
