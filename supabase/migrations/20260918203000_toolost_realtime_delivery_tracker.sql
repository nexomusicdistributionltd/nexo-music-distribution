-- TooLost realtime delivery tracking snapshots.
-- Persists provider truth without fabricating DSP delivery.
create table if not exists public.provider_delivery_snapshots (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.distribution_jobs (id) on delete cascade,
  release_id uuid not null references public.releases (id) on delete cascade,
  provider_name text not null default 'distribution_engine',
  provider_release_id text,
  release_status text not null,
  dsp_statuses jsonb not null default '[]'::jsonb,
  source text not null check (source in ('api_sync', 'webhook')),
  event_id text,
  captured_at timestamptz not null default now(),
  constraint provider_delivery_snapshots_dsp_array
    check (jsonb_typeof(dsp_statuses) = 'array')
);

create index if not exists provider_delivery_snapshots_release_idx
  on public.provider_delivery_snapshots (release_id, captured_at desc);
create index if not exists provider_delivery_snapshots_job_idx
  on public.provider_delivery_snapshots (job_id, captured_at desc)
  where job_id is not null;
create unique index if not exists provider_delivery_snapshots_webhook_event_uidx
  on public.provider_delivery_snapshots (provider_name, event_id)
  where event_id is not null;

alter table public.provider_delivery_snapshots enable row level security;

drop policy if exists "provider_delivery_snapshots_staff_select"
  on public.provider_delivery_snapshots;
create policy "provider_delivery_snapshots_staff_select"
  on public.provider_delivery_snapshots
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "provider_delivery_snapshots_no_client_write"
  on public.provider_delivery_snapshots;
create policy "provider_delivery_snapshots_no_client_write"
  on public.provider_delivery_snapshots
  for all to authenticated
  using (false)
  with check (false);

revoke all on table public.provider_delivery_snapshots from anon;
grant select on table public.provider_delivery_snapshots to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.provider_delivery_snapshots;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.distribution_jobs;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.provider_sync_runs;
  exception when duplicate_object then null;
  end;
end $$;

comment on table public.provider_delivery_snapshots is
  'Timestamped TooLost delivery truth from verified webhooks and authenticated API syncs. DSP rows are stored only when returned by the provider.';
