-- Realtime marketing operations control plane.
-- No external provider success is fabricated: provider_state/provider_reference are
-- operator/provider-backed facts and remain null until a real workflow updates them.

alter table public.portal_service_requests
  drop constraint if exists portal_service_requests_status_check;

alter table public.portal_service_requests
  add constraint portal_service_requests_status_check
  check (status in (
    'draft',
    'submitted',
    'reviewing',
    'needs_info',
    'accepted',
    'approved',
    'processing',
    'live',
    'completed',
    'rejected',
    'cancelled'
  ));

alter table public.portal_service_requests
  add column if not exists priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null,
  add column if not exists provider_state text,
  add column if not exists provider_reference text,
  add column if not exists provider_url text,
  add column if not exists provider_response jsonb not null default '{}'::jsonb,
  add column if not exists submitted_payload jsonb not null default '{}'::jsonb,
  add column if not exists completed_at timestamptz;

create index if not exists portal_service_status_idx
  on public.portal_service_requests (kind, status, created_at desc);

create table if not exists public.marketing_service_controls (
  kind text primary key,
  label text not null,
  enabled boolean not null default true,
  accepting_requests boolean not null default true,
  requires_release boolean not null default false,
  provider_mode text not null default 'internal'
    check (provider_mode in ('internal', 'toolost_manual', 'toolost_api')),
  provider_feature text,
  description text,
  admin_instructions text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists marketing_service_controls_set_updated_at on public.marketing_service_controls;
create trigger marketing_service_controls_set_updated_at
  before update on public.marketing_service_controls
  for each row execute function public.set_updated_at();

alter table public.marketing_service_controls enable row level security;

drop policy if exists "marketing_service_controls_select" on public.marketing_service_controls;
create policy "marketing_service_controls_select" on public.marketing_service_controls
  for select to authenticated
  using (true);

drop policy if exists "marketing_service_controls_staff_write" on public.marketing_service_controls;
create policy "marketing_service_controls_staff_write" on public.marketing_service_controls
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

insert into public.marketing_service_controls
  (kind, label, enabled, accepting_requests, requires_release, provider_mode, provider_feature, description, admin_instructions)
values
  ('dsp_pitching', 'DSP Pitching', true, true, true, 'toolost_manual', 'pitch_portal',
   'Editorial and promotional pitching intake for eligible unreleased music.',
   'Verify the release is provider-delivered and upcoming. Submit only through a documented provider workflow; record the real provider reference/status here.'),
  ('campaign', 'Release Campaign Builder', true, true, true, 'internal', null,
   'Build and operate a release campaign plan using real release metadata and approved marketing actions.',
   'Review objectives, dates, budget and assets. Keep execution states tied to completed work only.'),
  ('priority_pitch', 'Priority Pitch', true, true, true, 'toolost_manual', 'priority_pitch',
   'Priority pitching intake for eligible upcoming releases.',
   'TooLost documents one song per unreleased TooLost-distributed release and recommends 3–4 weeks lead time. Record provider submission/reference only after the real submission exists.'),
  ('spotify_discovery_mode', 'Spotify Discovery Mode', true, true, true, 'toolost_manual', 'spotify_discovery_mode',
   'Eligibility and enrollment workflow for Spotify Discovery Mode.',
   'Verify Spotify eligibility and the release/track status before provider submission. Do not mark enrolled until a real provider/Spotify state confirms it.'),
  ('promotional_assets', 'Promotional Assets', true, true, true, 'toolost_manual', 'promotional_assets',
   'Promotional creative asset workflow linked to a real release.',
   'Use the documented provider asset workflow when available. Save only real delivered asset URLs/references.'),
  ('fan_blast', 'Fan Blast', true, true, false, 'toolost_manual', 'fan_blast',
   'Fan communication campaign intake and execution tracking.',
   'Confirm the audience source and consent before sending. Provider delivery/open/click data must come from the real campaign response, never generated values.'),
  ('award_monitoring', 'Award Monitoring', true, true, false, 'toolost_manual', 'award_monitoring',
   'Monitor certification/award progress using provider-reported or verified external data.',
   'Record only verified award/certification progress and source references.'),
  ('third_party_playlisting', 'Third Party Playlisting', true, true, true, 'internal', null,
   'Human-reviewed third-party playlist outreach workflow.',
   'No guaranteed placement and no pay-for-placement representation. Track outreach and confirmed outcomes only.'),
  ('ad_box', 'Nexo Ad Box', true, true, true, 'internal', null,
   'Nexo-managed advertising campaign intake.',
   'Require approved budget, destination, audience and creative before launch. Store real platform campaign IDs/results when executed.'),
  ('influencers', 'Influencers', true, true, true, 'internal', null,
   'Influencer campaign sourcing and outreach workflow.',
   'Record creator selection, approval and confirmed post URLs/results only.'),
  ('labs', 'Nexo Labs', true, true, false, 'internal', null,
   'Opt-in queue for Nexo experimental tools.',
   'Enable only features that are actually available to the account.'),
  ('luminate', 'Luminate Registration', true, true, true, 'toolost_manual', 'chart_registration',
   'Release registration workflow for Luminate/industry chart tracking.',
   'TooLost documents chart registration through its Chart Registration workflow. Record the actual registration reference/state after submission.')
on conflict (kind) do update set
  label = excluded.label,
  requires_release = excluded.requires_release,
  provider_mode = excluded.provider_mode,
  provider_feature = excluded.provider_feature,
  description = excluded.description,
  admin_instructions = excluded.admin_instructions;

do $$
begin
  begin
    alter publication supabase_realtime add table public.marketing_service_controls;
  exception when duplicate_object then null;
  end;
end $$;
