-- Portal IA: service requests, videos, payees, members, tax, recoupments, payout requests.
-- Additive. RLS on every new table. Realtime for live lists.

-- ---------------------------------------------------------------------------
-- Service / rights / marketing requests
-- ---------------------------------------------------------------------------
create table if not exists public.portal_service_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  related_url text,
  release_id uuid references public.releases (id) on delete set null,
  track_id uuid references public.release_tracks (id) on delete set null,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'reviewing', 'accepted', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_service_title_len check (char_length(btrim(title)) between 2 and 200),
  constraint portal_service_body_len check (body is null or char_length(body) <= 8000)
);

create index if not exists portal_service_owner_idx
  on public.portal_service_requests (owner_user_id, created_at desc);
create index if not exists portal_service_kind_idx
  on public.portal_service_requests (kind, status);

drop trigger if exists portal_service_set_updated_at on public.portal_service_requests;
create trigger portal_service_set_updated_at
  before update on public.portal_service_requests
  for each row execute function public.set_updated_at();

alter table public.portal_service_requests enable row level security;

create policy "portal_service_select" on public.portal_service_requests
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "portal_service_insert" on public.portal_service_requests
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and status in ('draft', 'submitted')
    and reviewed_by is null
    and admin_note is null
  );

create policy "portal_service_owner_update" on public.portal_service_requests
  for update to authenticated
  using (owner_user_id = auth.uid() and status in ('draft', 'rejected'))
  with check (owner_user_id = auth.uid() and status in ('draft', 'submitted'));

create policy "portal_service_staff_update" on public.portal_service_requests
  for update to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Music video submissions
-- ---------------------------------------------------------------------------
create table if not exists public.music_video_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  video_url text not null,
  release_id uuid references public.releases (id) on delete set null,
  notes text,
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'accepted', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint music_video_title_len check (char_length(btrim(title)) between 2 and 300),
  constraint music_video_url_len check (char_length(btrim(video_url)) between 8 and 2000)
);

create index if not exists music_video_owner_idx
  on public.music_video_submissions (owner_user_id, created_at desc);

drop trigger if exists music_video_set_updated_at on public.music_video_submissions;
create trigger music_video_set_updated_at
  before update on public.music_video_submissions
  for each row execute function public.set_updated_at();

alter table public.music_video_submissions enable row level security;

create policy "music_video_select" on public.music_video_submissions
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "music_video_insert" on public.music_video_submissions
  for insert to authenticated
  with check (owner_user_id = auth.uid() and status = 'submitted' and admin_note is null);

create policy "music_video_staff_update" on public.music_video_submissions
  for update to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- SplitShare payees, assignments, recoupments
-- ---------------------------------------------------------------------------
create table if not exists public.portal_payees (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  email text,
  role_label text not null default 'other',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_payee_name_len check (char_length(btrim(name)) between 1 and 200)
);

create index if not exists portal_payees_owner_idx on public.portal_payees (owner_user_id);

drop trigger if exists portal_payees_set_updated_at on public.portal_payees;
create trigger portal_payees_set_updated_at
  before update on public.portal_payees
  for each row execute function public.set_updated_at();

alter table public.portal_payees enable row level security;

create policy "portal_payees_select" on public.portal_payees
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "portal_payees_write" on public.portal_payees
  for all to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create table if not exists public.split_track_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  track_id uuid not null references public.release_tracks (id) on delete cascade,
  split_rule_id uuid not null references public.royalty_split_rules (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (track_id)
);

create index if not exists split_track_owner_idx on public.split_track_assignments (owner_user_id);

alter table public.split_track_assignments enable row level security;

create policy "split_assign_select" on public.split_track_assignments
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "split_assign_write" on public.split_track_assignments
  for all to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create table if not exists public.portal_recoupments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'USD',
  notes text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_recoup_owner_idx on public.portal_recoupments (owner_user_id);

drop trigger if exists portal_recoup_set_updated_at on public.portal_recoupments;
create trigger portal_recoup_set_updated_at
  before update on public.portal_recoupments
  for each row execute function public.set_updated_at();

alter table public.portal_recoupments enable row level security;

create policy "portal_recoup_select" on public.portal_recoupments
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "portal_recoup_write" on public.portal_recoupments
  for all to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Account members, tax, enrollments, payout requests
-- ---------------------------------------------------------------------------
create table if not exists public.account_members (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  display_name text,
  role_label text not null default 'member',
  status text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  constraint account_members_email_len check (char_length(btrim(email)) between 5 and 320)
);

create index if not exists account_members_owner_idx on public.account_members (owner_user_id);

alter table public.account_members enable row level security;

create policy "account_members_select" on public.account_members
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "account_members_write" on public.account_members
  for all to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create table if not exists public.account_tax_details (
  owner_user_id uuid primary key references public.profiles (id) on delete cascade,
  legal_name text,
  country text,
  tax_id text,
  updated_at timestamptz not null default now()
);

alter table public.account_tax_details enable row level security;

create policy "account_tax_select" on public.account_tax_details
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "account_tax_write" on public.account_tax_details
  for all to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()))
  with check (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create table if not exists public.account_enrollments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  service_key text not null,
  status text not null default 'requested' check (status in ('requested', 'enrolled', 'declined')),
  created_at timestamptz not null default now(),
  unique (owner_user_id, service_key)
);

alter table public.account_enrollments enable row level security;

create policy "account_enroll_select" on public.account_enrollments
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "account_enroll_insert" on public.account_enrollments
  for insert to authenticated
  with check (owner_user_id = auth.uid() and status = 'requested');

create policy "account_enroll_staff" on public.account_enrollments
  for update to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'USD',
  method_note text,
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'approved', 'rejected', 'paid')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payout_requests_owner_idx
  on public.payout_requests (owner_user_id, created_at desc);

drop trigger if exists payout_requests_set_updated_at on public.payout_requests;
create trigger payout_requests_set_updated_at
  before update on public.payout_requests
  for each row execute function public.set_updated_at();

alter table public.payout_requests enable row level security;

create policy "payout_requests_select" on public.payout_requests
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "payout_requests_insert" on public.payout_requests
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and status = 'submitted'
    and admin_note is null
  );

create policy "payout_requests_staff" on public.payout_requests
  for update to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

do $$
begin
  begin
    alter publication supabase_realtime add table public.portal_service_requests;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.music_video_submissions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.portal_payees;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.split_track_assignments;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.portal_recoupments;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.account_members;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.payout_requests;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.account_enrollments;
  exception when duplicate_object then null;
  end;
end $$;
