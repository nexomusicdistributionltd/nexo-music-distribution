-- Artist/label identity verification with private live-camera evidence and staff review.
-- Sensitive identity images stay in a private Storage bucket and are never public.

do $$ begin
  create type public.identity_verification_status as enum (
    'draft',
    'submitted',
    'under_review',
    'verified',
    'declined',
    'additional_info_required'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.identity_document_type as enum (
    'nin',
    'national_id',
    'drivers_license',
    'passport'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  country_code char(2) not null,
  legal_name text not null,
  date_of_birth date not null,
  document_type public.identity_document_type not null,
  status public.identity_verification_status not null default 'draft',
  latest_submission_id uuid,
  reason text,
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  verified_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_legal_name_len check (char_length(btrim(legal_name)) between 2 and 160),
  constraint identity_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint identity_dob_valid check (date_of_birth >= date '1900-01-01' and date_of_birth <= current_date)
);

create table if not exists public.identity_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.identity_verifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type public.identity_document_type not null,
  document_front_path text,
  document_back_path text,
  selfie_path text,
  status public.identity_verification_status not null default 'draft',
  reason text,
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint identity_submission_paths_owned check (
    (document_front_path is null or document_front_path like user_id::text || '/%')
    and (document_back_path is null or document_back_path like user_id::text || '/%')
    and (selfie_path is null or selfie_path like user_id::text || '/%')
  )
);

alter table public.identity_verifications
  drop constraint if exists identity_verifications_latest_submission_id_fkey;
alter table public.identity_verifications
  add constraint identity_verifications_latest_submission_id_fkey
  foreign key (latest_submission_id)
  references public.identity_verification_submissions(id)
  on delete set null;

create table if not exists public.identity_verification_events (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.identity_verifications(id) on delete cascade,
  submission_id uuid references public.identity_verification_submissions(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint identity_event_no_secrets check (
    not (metadata ? 'password')
    and not (metadata ? 'token')
    and not (metadata ? 'access_token')
    and not (metadata ? 'refresh_token')
  )
);

create index if not exists identity_verifications_status_idx
  on public.identity_verifications(status, updated_at desc);
create index if not exists identity_verification_submissions_user_idx
  on public.identity_verification_submissions(user_id, created_at desc);
create index if not exists identity_verification_submissions_status_idx
  on public.identity_verification_submissions(status, created_at desc);
create index if not exists identity_verification_events_verification_idx
  on public.identity_verification_events(verification_id, created_at desc);

drop trigger if exists identity_verifications_set_updated_at on public.identity_verifications;
create trigger identity_verifications_set_updated_at
  before update on public.identity_verifications
  for each row execute function public.set_updated_at();

alter table public.identity_verifications enable row level security;
alter table public.identity_verification_submissions enable row level security;
alter table public.identity_verification_events enable row level security;

drop policy if exists "identity_verifications_select_own_or_staff" on public.identity_verifications;
create policy "identity_verifications_select_own_or_staff"
  on public.identity_verifications
  for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_staff((select auth.uid())));

drop policy if exists "identity_submissions_select_own_or_staff" on public.identity_verification_submissions;
create policy "identity_submissions_select_own_or_staff"
  on public.identity_verification_submissions
  for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_staff((select auth.uid())));

drop policy if exists "identity_events_select_own_or_staff" on public.identity_verification_events;
create policy "identity_events_select_own_or_staff"
  on public.identity_verification_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_staff((select auth.uid())));

grant select on public.identity_verifications to authenticated;
grant select on public.identity_verification_submissions to authenticated;
grant select on public.identity_verification_events to authenticated;
revoke insert, update, delete on public.identity_verifications from anon, authenticated;
revoke insert, update, delete on public.identity_verification_submissions from anon, authenticated;
revoke insert, update, delete on public.identity_verification_events from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-verification',
  'identity-verification',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "identity_storage_insert_own" on storage.objects;
create policy "identity_storage_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'identity-verification'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "identity_storage_select_own_or_staff" on storage.objects;
create policy "identity_storage_select_own_or_staff"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'identity-verification'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_staff((select auth.uid()))
    )
  );

drop policy if exists "identity_storage_update_own" on storage.objects;
create policy "identity_storage_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'identity-verification'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'identity-verification'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "identity_storage_delete_own_draft" on storage.objects;
create policy "identity_storage_delete_own_draft"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'identity-verification'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

do $$
begin
  begin
    alter publication supabase_realtime add table public.identity_verifications;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.identity_verification_submissions;
  exception when duplicate_object then null;
  end;
end $$;
