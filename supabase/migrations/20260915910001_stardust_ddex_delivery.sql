-- NEXO — Stardust Distro as internal DDEX/ERN generation + delivery layer.
-- Additive only. Reuses ddex_messages. Does NOT seed commercial DSP targets.
-- Credentials never stored in tables — env key names only.

-- ---------------------------------------------------------------------------
-- dsp_targets (secure config; no secrets)
-- ---------------------------------------------------------------------------
create table if not exists public.dsp_targets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  protocol text not null
    check (protocol in ('local', 'ftp', 'sftp', 's3', 'rest', 'azure')),
  ern_version text not null default '4.3.2'
    check (ern_version in ('4.3.2', '4.3', '4.2', '3.8.2')),
  recipient_name text,
  recipient_dpid_env_key text,
  credential_env_prefix text,
  is_test boolean not null default false,
  is_active boolean not null default false,
  commercial_approval_required boolean not null default true,
  planning_only boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.dsp_targets is
  'DDEX delivery targets. No secrets. Commercial DSPs are NOT seeded. Stardust does not create DSP relationships.';
comment on column public.dsp_targets.recipient_dpid_env_key is
  'Name of a server-only env var holding the recipient DPID. Never the DPID itself.';
comment on column public.dsp_targets.credential_env_prefix is
  'Env prefix for protocol secrets (e.g. NEXO_DSP_TEST_). Values live in host secrets only.';

create index if not exists dsp_targets_active_idx on public.dsp_targets (is_active, protocol);

insert into public.dsp_targets (
  slug, display_name, protocol, ern_version, recipient_name,
  credential_env_prefix, is_test, is_active,
  commercial_approval_required, planning_only, notes
)
values (
  'nexo-local-test',
  'Nexo Local Test Target',
  'local',
  '4.3.2',
  'Nexo Local Test Recipient',
  'NEXO_DSP_TEST_',
  true,
  true,
  false,
  false,
  'Isolated local/test delivery into private storage. Not a commercial DSP. MessageControlType=TestMessage. Loopback recipient uses Nexo sender DPID only.'
)
on conflict (slug) do nothing;

alter table public.dsp_targets enable row level security;

drop policy if exists "dsp_targets_staff_select" on public.dsp_targets;
create policy "dsp_targets_staff_select" on public.dsp_targets
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "dsp_targets_staff_write" on public.dsp_targets;
create policy "dsp_targets_staff_write" on public.dsp_targets
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Extend ddex_messages (reuse ledger)
-- ---------------------------------------------------------------------------
alter table public.ddex_messages
  add column if not exists target_id uuid references public.dsp_targets (id),
  add column if not exists message_subtype text not null default 'Initial',
  add column if not exists message_thread_id text,
  add column if not exists package_status text not null default 'none',
  add column if not exists package_storage_path text,
  add column if not exists package_sha256 text,
  add column if not exists idempotency_key text,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists ack_reference text,
  add column if not exists queued_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists validation_report jsonb;

alter table public.ddex_messages
  drop constraint if exists ddex_messages_message_subtype_chk;
alter table public.ddex_messages
  add constraint ddex_messages_message_subtype_chk
  check (message_subtype in ('Initial', 'Update', 'Takedown'));

alter table public.ddex_messages
  drop constraint if exists ddex_messages_package_status_chk;
alter table public.ddex_messages
  add constraint ddex_messages_package_status_chk
  check (package_status in ('none', 'packaged', 'ready_for_delivery'));

alter table public.ddex_messages
  drop constraint if exists ddex_messages_delivery_status_chk;
alter table public.ddex_messages
  add constraint ddex_messages_delivery_status_chk
  check (delivery_status in (
    'pending', 'queued', 'sending', 'ready_for_delivery',
    'delivered', 'failed', 'acknowledged', 'cancelled'
  ));

alter table public.ddex_messages
  drop constraint if exists ddex_messages_ern_version_chk;
alter table public.ddex_messages
  add constraint ddex_messages_ern_version_chk
  check (ern_version in ('4.3.2', '4.3', '4.2', '3.8.2'));

create unique index if not exists ddex_messages_idempotency_uidx
  on public.ddex_messages (idempotency_key)
  where idempotency_key is not null;

create index if not exists ddex_messages_target_idx
  on public.ddex_messages (target_id, created_at desc);

create index if not exists ddex_messages_queue_idx
  on public.ddex_messages (delivery_status, next_retry_at);

comment on table public.ddex_messages is
  'Staff ERN ledger + delivery queue. Catalog release_status is never flipped to live by this table. Local test delivery is not commercial DSP delivery.';

-- Owner may read their own rows (status visibility). Writes remain staff-only.
drop policy if exists "ddex_messages_owner_select" on public.ddex_messages;
create policy "ddex_messages_owner_select" on public.ddex_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.releases r
      where r.id = ddex_messages.release_id
        and r.owner_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Validation runs + delivery attempts + acknowledgments
-- ---------------------------------------------------------------------------
create table if not exists public.ddex_validation_runs (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  target_id uuid references public.dsp_targets (id),
  can_generate boolean not null default false,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index if not exists ddex_validation_runs_release_idx
  on public.ddex_validation_runs (release_id, created_at desc);

comment on table public.ddex_validation_runs is
  'Stored DDEX validation results for Admin. Never fabricates missing metadata.';

alter table public.ddex_validation_runs enable row level security;

drop policy if exists "ddex_validation_runs_staff_select" on public.ddex_validation_runs;
create policy "ddex_validation_runs_staff_select" on public.ddex_validation_runs
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "ddex_validation_runs_staff_write" on public.ddex_validation_runs;
create policy "ddex_validation_runs_staff_write" on public.ddex_validation_runs
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists "ddex_validation_runs_owner_select" on public.ddex_validation_runs;
create policy "ddex_validation_runs_owner_select" on public.ddex_validation_runs
  for select to authenticated
  using (
    exists (
      select 1 from public.releases r
      where r.id = ddex_validation_runs.release_id
        and r.owner_user_id = auth.uid()
    )
  );

create table if not exists public.ddex_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  message_id text not null references public.ddex_messages (message_id) on delete cascade,
  attempt int not null,
  protocol text not null,
  status text not null check (status in ('sending', 'delivered', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists ddex_delivery_attempts_message_idx
  on public.ddex_delivery_attempts (message_id, created_at desc);

alter table public.ddex_delivery_attempts enable row level security;

drop policy if exists "ddex_delivery_attempts_staff_all" on public.ddex_delivery_attempts;
create policy "ddex_delivery_attempts_staff_all" on public.ddex_delivery_attempts
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create table if not exists public.ddex_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  message_id text not null references public.ddex_messages (message_id) on delete cascade,
  ack_type text not null default 'manual',
  ack_reference text,
  raw_storage_path text,
  processed_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index if not exists ddex_acknowledgments_message_idx
  on public.ddex_acknowledgments (message_id, processed_at desc);

alter table public.ddex_acknowledgments enable row level security;

drop policy if exists "ddex_acknowledgments_staff_all" on public.ddex_acknowledgments;
create policy "ddex_acknowledgments_staff_all" on public.ddex_acknowledgments
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Owner-safe status (no credentials, no XML, no endpoints)
-- ---------------------------------------------------------------------------
create or replace function public.list_owner_ddex_status(p_release_id uuid)
returns table (
  message_id text,
  message_subtype text,
  validation_status text,
  delivery_status text,
  package_status text,
  ern_version text,
  created_at timestamptz,
  acknowledged_at timestamptz,
  target_name text,
  target_is_test boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.message_id,
    m.message_subtype,
    m.validation_status,
    m.delivery_status,
    m.package_status,
    m.ern_version,
    m.created_at,
    m.acknowledged_at,
    t.display_name,
    coalesce(t.is_test, false)
  from public.ddex_messages m
  join public.releases r on r.id = m.release_id
  left join public.dsp_targets t on t.id = m.target_id
  where m.release_id = p_release_id
    and (
      r.owner_user_id = auth.uid()
      or public.is_staff(auth.uid())
    )
  order by m.created_at desc
  limit 50;
$$;

revoke all on function public.list_owner_ddex_status(uuid) from public;
grant execute on function public.list_owner_ddex_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Private package bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ddex-packages',
  'ddex-packages',
  false,
  52428800,
  array['application/xml', 'text/xml', 'application/json', 'application/octet-stream']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "ddex_packages_staff_select" on storage.objects;
create policy "ddex_packages_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'ddex-packages' and public.is_staff(auth.uid()));

drop policy if exists "ddex_packages_staff_insert" on storage.objects;
create policy "ddex_packages_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ddex-packages' and public.is_staff(auth.uid()));

drop policy if exists "ddex_packages_staff_update" on storage.objects;
create policy "ddex_packages_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'ddex-packages' and public.is_staff(auth.uid()))
  with check (bucket_id = 'ddex-packages' and public.is_staff(auth.uid()));
