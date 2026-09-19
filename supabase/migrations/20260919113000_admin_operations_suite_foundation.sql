-- Nexo Admin Operations Suite foundation.
-- Additive only: existing release/distribution/royalty workflows remain unchanged by default.

create table if not exists public.admin_ops_cases (
  id uuid primary key default gen_random_uuid(),
  case_type text not null check (case_type in (
    'rights_claim','fraud_review','catalog_conflict','privacy_request',
    'security_review','tax_compliance','email_deliverability'
  )),
  title text not null check (char_length(title) between 3 and 240),
  description text,
  status text not null default 'open' check (status in (
    'open','investigating','waiting','action_required','resolved','closed'
  )),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  subject_user_id uuid references public.profiles(id) on delete set null,
  release_id uuid references public.releases(id) on delete set null,
  track_id uuid references public.release_tracks(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  payout_hold boolean not null default false,
  distribution_hold boolean not null default false,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_ops_cases_type_status_idx
  on public.admin_ops_cases(case_type,status,priority,updated_at desc);
create index if not exists admin_ops_cases_subject_idx
  on public.admin_ops_cases(subject_user_id,updated_at desc);
create index if not exists admin_ops_cases_release_idx
  on public.admin_ops_cases(release_id,updated_at desc);

create table if not exists public.admin_ops_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.admin_ops_cases(id) on delete cascade,
  event_type text not null default 'note',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists admin_ops_case_events_case_idx
  on public.admin_ops_case_events(case_id,created_at desc);

create table if not exists public.admin_ops_case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.admin_ops_cases(id) on delete cascade,
  label text not null,
  evidence_url text,
  storage_path text,
  mime_type text,
  notes text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (evidence_url is not null or storage_path is not null or notes is not null)
);
create index if not exists admin_ops_case_evidence_case_idx
  on public.admin_ops_case_evidence(case_id,created_at desc);

create table if not exists public.admin_feature_flags (
  key text primary key,
  label text not null,
  description text,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.admin_feature_flags(key,label,description,enabled) values
  ('release_submissions','Release submissions','Allow artists and labels to submit releases to QC.',true),
  ('payout_requests','Payout requests','Allow artists and labels to request payouts.',true),
  ('move_in_catalog','Move-In catalog','Allow catalog migration / Move-In requests.',true),
  ('video_distribution','Video distribution','Allow music-video distribution submissions.',true),
  ('playlist_pitching','Playlist pitching','Allow playlist-pitching submissions.',true),
  ('fan_blast','Fan Blast','Allow Fan Blast service requests.',true),
  ('identity_verification_required','Identity verification required','Require verified identity for artist/label workspace access.',true),
  ('maintenance_mode','Maintenance mode','Show platform maintenance state; does not block admin access.',false),
  ('high_risk_dual_approval','Dual approval for high-risk actions','Require a second authorized admin before sensitive actions are executed.',false)
on conflict (key) do nothing;

create table if not exists public.admin_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 180),
  body text not null check (char_length(body) between 1 and 5000),
  audience text not null default 'all' check (audience in (
    'all','artists','labels','paid_artists','free_artists',
    'paid_labels','free_labels','specific_user','country'
  )),
  target_user_id uuid references public.profiles(id) on delete cascade,
  country_code text,
  severity text not null default 'info' check (severity in ('info','success','warning','critical')),
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((audience='specific_user' and target_user_id is not null) or audience <> 'specific_user'),
  check ((audience='country' and country_code is not null) or audience <> 'country')
);
create index if not exists admin_announcements_active_idx
  on public.admin_announcements(active,starts_at,ends_at);

create table if not exists public.admin_announcement_reads (
  announcement_id uuid not null references public.admin_announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id,user_id)
);

create table if not exists public.admin_high_risk_requests (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  target_type text,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed','cancelled')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  execution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reviewed_by is null or reviewed_by <> requested_by)
);
create index if not exists admin_high_risk_requests_status_idx
  on public.admin_high_risk_requests(status,created_at desc);

create table if not exists public.email_suppressions (
  email text primary key,
  active boolean not null default true,
  reason text not null,
  source text not null default 'admin',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(email))
);

create table if not exists public.tax_compliance_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'not_required' check (status in (
    'not_required','required','submitted','reviewing','verified','expired','blocked'
  )),
  country_code text,
  withholding_bps integer not null default 0 check (withholding_bps between 0 and 10000),
  hold_payouts boolean not null default false,
  notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.distribution_store_capabilities (
  store_key text primary key,
  display_name text not null,
  operational_status text not null default 'unknown' check (operational_status in (
    'unknown','available','limited','approval_required','disabled'
  )),
  audio_supported boolean,
  video_supported boolean,
  atmos_supported boolean,
  territories text[] not null default '{}'::text[],
  restrictions jsonb not null default '{}'::jsonb,
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.distribution_store_capabilities(store_key,display_name) values
 ('spotify','Spotify'),('apple_music','Apple Music'),('youtube_music','YouTube Music'),
 ('amazon_music','Amazon Music'),('deezer','Deezer'),('tidal','TIDAL'),
 ('tiktok','TikTok'),('meta','Meta / Facebook / Instagram'),('beatport','Beatport'),
 ('audiomack','Audiomack'),('pandora','Pandora')
on conflict (store_key) do nothing;

create table if not exists public.admin_policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null,
  version text not null,
  title text not null,
  body_html text not null,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  effective_at timestamptz,
  requires_reacceptance boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(policy_key,version)
);

create table if not exists public.admin_policy_acceptances (
  policy_version_id uuid not null references public.admin_policy_versions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (policy_version_id,user_id)
);

alter table public.admin_ops_cases enable row level security;
alter table public.admin_ops_case_events enable row level security;
alter table public.admin_ops_case_evidence enable row level security;
alter table public.admin_feature_flags enable row level security;
alter table public.admin_announcements enable row level security;
alter table public.admin_announcement_reads enable row level security;
alter table public.admin_high_risk_requests enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.tax_compliance_profiles enable row level security;
alter table public.distribution_store_capabilities enable row level security;
alter table public.admin_policy_versions enable row level security;
alter table public.admin_policy_acceptances enable row level security;

revoke all on public.admin_ops_cases, public.admin_ops_case_events, public.admin_ops_case_evidence,
  public.admin_high_risk_requests, public.email_suppressions, public.tax_compliance_profiles,
  public.distribution_store_capabilities, public.admin_policy_versions, public.admin_policy_acceptances
from anon, authenticated;
grant select,insert,update on public.admin_ops_cases, public.admin_ops_case_events, public.admin_ops_case_evidence,
  public.admin_high_risk_requests, public.email_suppressions, public.tax_compliance_profiles,
  public.distribution_store_capabilities, public.admin_policy_versions
to authenticated;
grant select on public.admin_policy_acceptances to authenticated;

revoke all on public.admin_feature_flags, public.admin_announcements, public.admin_announcement_reads from anon, authenticated;
grant select on public.admin_feature_flags to authenticated;
grant select,insert,update on public.admin_announcements to authenticated;
grant select,insert on public.admin_announcement_reads to authenticated;

drop policy if exists admin_ops_cases_staff on public.admin_ops_cases;
create policy admin_ops_cases_staff on public.admin_ops_cases
for all to authenticated
using (public.has_staff_permission(auth.uid(),'admin:operations'))
with check (public.has_staff_permission(auth.uid(),'admin:operations'));

drop policy if exists admin_ops_case_events_staff on public.admin_ops_case_events;
create policy admin_ops_case_events_staff on public.admin_ops_case_events
for all to authenticated
using (public.has_staff_permission(auth.uid(),'admin:operations'))
with check (public.has_staff_permission(auth.uid(),'admin:operations'));

drop policy if exists admin_ops_case_evidence_staff on public.admin_ops_case_evidence;
create policy admin_ops_case_evidence_staff on public.admin_ops_case_evidence
for all to authenticated
using (public.has_staff_permission(auth.uid(),'admin:operations'))
with check (public.has_staff_permission(auth.uid(),'admin:operations'));

drop policy if exists admin_feature_flags_read on public.admin_feature_flags;
create policy admin_feature_flags_read on public.admin_feature_flags
for select to authenticated using (true);

drop policy if exists admin_feature_flags_staff_write on public.admin_feature_flags;
create policy admin_feature_flags_staff_write on public.admin_feature_flags
for update to authenticated
using (public.has_staff_permission(auth.uid(),'admin:settings'))
with check (public.has_staff_permission(auth.uid(),'admin:settings'));

drop policy if exists admin_announcements_staff_write on public.admin_announcements;
create policy admin_announcements_staff_write on public.admin_announcements
for all to authenticated
using (public.has_staff_permission(auth.uid(),'admin:notifications'))
with check (public.has_staff_permission(auth.uid(),'admin:notifications'));

drop policy if exists admin_announcements_targeted_read on public.admin_announcements;
create policy admin_announcements_targeted_read on public.admin_announcements
for select to authenticated
using (
  active
  and starts_at <= now()
  and (ends_at is null or ends_at > now())
  and (
    public.has_staff_permission(auth.uid(),'admin:notifications')
    or audience='all'
    or (audience='specific_user' and target_user_id=auth.uid())
    or (audience='country' and exists (
      select 1 from public.profiles p where p.id=auth.uid() and upper(coalesce(p.country,''))=upper(coalesce(country_code,''))
    ))
    or (audience in ('artists','paid_artists','free_artists') and exists (
      select 1 from public.profiles p where p.id=auth.uid() and p.account_type='artist'
    ))
    or (audience in ('labels','paid_labels','free_labels') and exists (
      select 1 from public.profiles p where p.id=auth.uid() and p.account_type='label'
    ))
  )
);

drop policy if exists announcement_reads_own on public.admin_announcement_reads;
create policy announcement_reads_own on public.admin_announcement_reads
for all to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

drop policy if exists high_risk_staff on public.admin_high_risk_requests;
create policy high_risk_staff on public.admin_high_risk_requests
for all to authenticated
using (public.has_staff_permission(auth.uid(),'admin:operations'))
with check (public.has_staff_permission(auth.uid(),'admin:operations'));

drop policy if exists email_suppressions_staff on public.email_suppressions;
create policy email_suppressions_staff on public.email_suppressions
for all to authenticated
using (public.has_staff_permission(auth.uid(),'admin:emails'))
with check (public.has_staff_permission(auth.uid(),'admin:emails'));

drop policy if exists tax_compliance_staff on public.tax_compliance_profiles;
create policy tax_compliance_staff on public.tax_compliance_profiles
for all to authenticated
using (public.has_staff_permission(auth.uid(),'admin:finance'))
with check (public.has_staff_permission(auth.uid(),'admin:finance'));

drop policy if exists tax_compliance_own_read on public.tax_compliance_profiles;
create policy tax_compliance_own_read on public.tax_compliance_profiles
for select to authenticated using (user_id=auth.uid());

drop policy if exists store_capabilities_staff on public.distribution_store_capabilities;
create policy store_capabilities_staff on public.distribution_store_capabilities
for all to authenticated
using (public.has_staff_permission(auth.uid(),'admin:distribution'))
with check (public.has_staff_permission(auth.uid(),'admin:distribution'));

drop policy if exists policy_versions_staff on public.admin_policy_versions;
create policy policy_versions_staff on public.admin_policy_versions
for all to authenticated
using (public.has_staff_permission(auth.uid(),'admin:compliance'))
with check (public.has_staff_permission(auth.uid(),'admin:compliance'));

drop policy if exists policy_acceptances_staff_read on public.admin_policy_acceptances;
create policy policy_acceptances_staff_read on public.admin_policy_acceptances
for select to authenticated
using (public.has_staff_permission(auth.uid(),'admin:compliance') or user_id=auth.uid());

create or replace function public.admin_revoke_user_otp_sessions(p_user_id uuid, p_reason text default null)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  affected integer := 0;
begin
  if actor is null or not public.has_staff_permission(actor,'admin:users') then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  delete from public.login_otp_verified_sessions where user_id=p_user_id;
  get diagnostics affected = row_count;
  insert into public.admin_ops_case_events(case_id,event_type,message,metadata,actor_user_id)
  select c.id,'security_action',
         'OTP-verified sessions revoked by administrator.',
         jsonb_build_object('target_user_id',p_user_id,'reason',coalesce(p_reason,''),'sessions_revoked',affected),
         actor
  from public.admin_ops_cases c
  where c.subject_user_id=p_user_id and c.case_type='security_review' and c.status not in ('resolved','closed')
  order by c.updated_at desc limit 1;
  return affected;
end;
$$;
revoke all on function public.admin_revoke_user_otp_sessions(uuid,text) from public,anon;
grant execute on function public.admin_revoke_user_otp_sessions(uuid,text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_ops_cases'
  ) then alter publication supabase_realtime add table public.admin_ops_cases; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_ops_case_events'
  ) then alter publication supabase_realtime add table public.admin_ops_case_events; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_feature_flags'
  ) then alter publication supabase_realtime add table public.admin_feature_flags; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_announcements'
  ) then alter publication supabase_realtime add table public.admin_announcements; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_high_risk_requests'
  ) then alter publication supabase_realtime add table public.admin_high_risk_requests; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='email_suppressions'
  ) then alter publication supabase_realtime add table public.email_suppressions; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tax_compliance_profiles'
  ) then alter publication supabase_realtime add table public.tax_compliance_profiles; end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='distribution_store_capabilities'
  ) then alter publication supabase_realtime add table public.distribution_store_capabilities; end if;
end $$;

comment on table public.admin_ops_cases is 'Unified staff operations cases for rights, fraud, catalog conflicts, privacy, security, tax and email-deliverability investigations.';
comment on table public.admin_feature_flags is 'Admin-operated product controls. Existing behavior remains enabled by default.';
comment on table public.admin_high_risk_requests is 'Dual-control workflow records for sensitive actions. Enforcement is opt-in through the high_risk_dual_approval feature flag.';
