-- Identity verification final realtime/fraud hardening.
-- Keeps user-visible verification state realtime while fraud signals remain staff-only.

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'identity_verification_status'
  ) and exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'identity_verification_status'
      and e.enumlabel = 'additional_information_required'
  ) and not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'identity_verification_status'
      and e.enumlabel = 'additional_info_required'
  ) then
    alter type public.identity_verification_status
      rename value 'additional_information_required' to 'additional_info_required';
  end if;
end $$;

alter table public.identity_verification_submissions
  add column if not exists document_front_sha256 text,
  add column if not exists document_back_sha256 text,
  add column if not exists selfie_sha256 text,
  add column if not exists capture_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.identity_verification_submissions'::regclass
      and conname = 'identity_submission_front_hash_format'
  ) then
    alter table public.identity_verification_submissions
      add constraint identity_submission_front_hash_format
      check (document_front_sha256 is null or document_front_sha256 ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.identity_verification_submissions'::regclass
      and conname = 'identity_submission_back_hash_format'
  ) then
    alter table public.identity_verification_submissions
      add constraint identity_submission_back_hash_format
      check (document_back_sha256 is null or document_back_sha256 ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.identity_verification_submissions'::regclass
      and conname = 'identity_submission_selfie_hash_format'
  ) then
    alter table public.identity_verification_submissions
      add constraint identity_submission_selfie_hash_format
      check (selfie_sha256 is null or selfie_sha256 ~ '^[0-9a-f]{64}$');
  end if;
end $$;

create index if not exists identity_submission_front_hash_idx
  on public.identity_verification_submissions(document_front_sha256)
  where document_front_sha256 is not null;
create index if not exists identity_submission_back_hash_idx
  on public.identity_verification_submissions(document_back_sha256)
  where document_back_sha256 is not null;
create index if not exists identity_submission_selfie_hash_idx
  on public.identity_verification_submissions(selfie_sha256)
  where selfie_sha256 is not null;

create table if not exists public.identity_verification_risk_signals (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.identity_verifications(id) on delete cascade,
  submission_id uuid not null references public.identity_verification_submissions(id) on delete cascade,
  signal_type text not null,
  severity text not null default 'medium'
    check (severity in ('low','medium','high')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (submission_id, signal_type)
);

create index if not exists identity_risk_verification_idx
  on public.identity_verification_risk_signals(verification_id, created_at desc);

alter table public.identity_verification_risk_signals enable row level security;

drop policy if exists "identity_risk_staff_read" on public.identity_verification_risk_signals;
create policy "identity_risk_staff_read"
  on public.identity_verification_risk_signals
  for select
  to authenticated
  using (public.is_staff((select auth.uid())));

revoke insert, update, delete on public.identity_verification_risk_signals from anon, authenticated;
grant select on public.identity_verification_risk_signals to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.identity_verifications;
  exception when duplicate_object then null;
  end;
end $$;
