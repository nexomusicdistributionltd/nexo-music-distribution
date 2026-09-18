-- Final artist/label identity verification schema.
-- Compatible with the earlier production verification draft while keeping all
-- identity evidence private and camera-only in the application.

do $$ begin
  create type public.identity_verification_status as enum (
    'draft',
    'submitted',
    'under_review',
    'additional_information_required',
    'verified',
    'declined'
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
  account_type text not null,
  country_code text not null,
  legal_full_name text not null,
  legal_name text,
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
  updated_at timestamptz not null default now()
);

alter table public.identity_verifications
  add column if not exists legal_name text,
  add column if not exists latest_submission_id uuid,
  add column if not exists reason text,
  add column if not exists admin_note text,
  add column if not exists verified_at timestamptz;

update public.identity_verifications
set legal_name = coalesce(nullif(btrim(legal_name), ''), legal_full_name)
where legal_name is null or btrim(legal_name) = '';

alter table public.identity_verifications
  alter column legal_name set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.identity_verifications'::regclass
      and conname = 'identity_legal_name_len'
  ) then
    alter table public.identity_verifications
      add constraint identity_legal_name_len
      check (char_length(btrim(legal_name)) between 2 and 160);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.identity_verifications'::regclass
      and conname = 'identity_country_code_format'
  ) then
    alter table public.identity_verifications
      add constraint identity_country_code_format
      check (country_code ~ '^[A-Z]{2}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.identity_verifications'::regclass
      and conname = 'identity_dob_valid'
  ) then
    alter table public.identity_verifications
      add constraint identity_dob_valid
      check (date_of_birth >= date '1900-01-01' and date_of_birth <= current_date);
  end if;
end $$;

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
  verified_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint identity_submission_paths_owned check (
    (document_front_path is null or document_front_path like user_id::text || '/%')
    and (document_back_path is null or document_back_path like user_id::text || '/%')
    and (selfie_path is null or selfie_path like user_id::text || '/%')
  )
);

alter table public.identity_verification_submissions
  add column if not exists verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.identity_verifications'::regclass
      and conname = 'identity_verifications_latest_submission_id_fkey'
  ) then
    alter table public.identity_verifications
      add constraint identity_verifications_latest_submission_id_fkey
      foreign key (latest_submission_id)
      references public.identity_verification_submissions(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.identity_verification_events (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.identity_verifications(id) on delete cascade,
  submission_id uuid references public.identity_verification_submissions(id) on delete set null,
  user_id uuid references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.identity_verification_events
  add column if not exists submission_id uuid,
  add column if not exists user_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'identity_verification_events'
      and column_name = 'details'
  ) then
    execute $sql$
      update public.identity_verification_events
      set metadata = coalesce(metadata, details, '{}'::jsonb)
    $sql$;
  end if;
end $$;

update public.identity_verification_events e
set user_id = v.user_id
from public.identity_verifications v
where e.verification_id = v.id
  and e.user_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.identity_verification_events'::regclass
      and conname = 'identity_verification_events_submission_id_fkey'
  ) then
    alter table public.identity_verification_events
      add constraint identity_verification_events_submission_id_fkey
      foreign key (submission_id)
      references public.identity_verification_submissions(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.identity_verification_events'::regclass
      and conname = 'identity_event_no_secrets'
  ) then
    alter table public.identity_verification_events
      add constraint identity_event_no_secrets check (
        not (metadata ? 'password')
        and not (metadata ? 'token')
        and not (metadata ? 'access_token')
        and not (metadata ? 'refresh_token')
      );
  end if;
end $$;

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

-- Reads are available only to the owner or Nexo staff.
drop policy if exists "identity_verification_owner_read" on public.identity_verifications;
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

drop policy if exists "identity_events_owner_read" on public.identity_verification_events;
drop policy if exists "identity_events_select_own_or_staff" on public.identity_verification_events;
create policy "identity_events_select_own_or_staff"
  on public.identity_verification_events
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_staff((select auth.uid()))
    or exists (
      select 1 from public.identity_verifications v
      where v.id = verification_id
        and v.user_id = (select auth.uid())
    )
  );

-- All identity metadata writes go through authenticated server actions using
-- the service role. This prevents a browser from marking itself verified.
drop policy if exists "identity_verification_owner_insert" on public.identity_verifications;
drop policy if exists "identity_verification_owner_update_draft" on public.identity_verifications;
revoke insert, update, delete on public.identity_verifications from anon, authenticated;
revoke insert, update, delete on public.identity_verification_submissions from anon, authenticated;
revoke insert, update, delete on public.identity_verification_events from anon, authenticated;
grant select on public.identity_verifications to authenticated;
grant select on public.identity_verification_submissions to authenticated;
grant select on public.identity_verification_events to authenticated;

-- The earlier evidence table is retained for backwards compatibility but is
-- no longer browser-writable. New evidence is represented by submissions.
do $$
begin
  if to_regclass('public.identity_verification_evidence') is not null then
    execute 'drop policy if exists "identity_evidence_owner_insert" on public.identity_verification_evidence';
    execute 'drop policy if exists "identity_evidence_owner_update" on public.identity_verification_evidence';
    execute 'revoke insert, update, delete on public.identity_verification_evidence from anon, authenticated';
  end if;
end $$;

-- Disable the earlier verification RPC surface so the final server-action workflow
-- is the only mutation path available to artist/label browser sessions.
do $
begin
  if to_regprocedure('public.submit_identity_verification(uuid)') is not null then
    execute 'revoke all on function public.submit_identity_verification(uuid) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.review_identity_verification(uuid,public.identity_verification_status,text)') is not null then
    execute 'revoke all on function public.review_identity_verification(uuid,public.identity_verification_status,text) from public, anon, authenticated';
  end if;
end $;

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

-- Camera files live at user_id/submission_id/document-front.jpg etc.
-- A user may upload/replace/delete only while that submission is still draft.
drop policy if exists "identity_storage_owner_insert" on storage.objects;
drop policy if exists "identity_storage_insert_own" on storage.objects;
create policy "identity_storage_insert_own_draft"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'identity-verification'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.identity_verification_submissions s
      where s.id::text = (storage.foldername(name))[2]
        and s.user_id = (select auth.uid())
        and s.status = 'draft'
    )
  );

drop policy if exists "identity_storage_owner_select" on storage.objects;
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
create policy "identity_storage_update_own_draft"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'identity-verification'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.identity_verification_submissions s
      where s.id::text = (storage.foldername(name))[2]
        and s.user_id = (select auth.uid())
        and s.status = 'draft'
    )
  )
  with check (
    bucket_id = 'identity-verification'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.identity_verification_submissions s
      where s.id::text = (storage.foldername(name))[2]
        and s.user_id = (select auth.uid())
        and s.status = 'draft'
    )
  );

drop policy if exists "identity_storage_delete_own_draft" on storage.objects;
create policy "identity_storage_delete_own_draft"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'identity-verification'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.identity_verification_submissions s
      where s.id::text = (storage.foldername(name))[2]
        and s.user_id = (select auth.uid())
        and s.status = 'draft'
    )
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
