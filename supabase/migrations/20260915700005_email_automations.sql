-- Configurable automations for NexoBot catalog keys + optional admin internals.
-- Enabled flag is checked before enqueue. Auth_* keys are listed as hosted (never outbox).

create table if not exists public.email_automations (
  key text primary key,
  catalog_key text,
  name text not null,
  trigger_label text not null,
  recipient_type text not null,
  enabled boolean not null default true,
  dormant boolean not null default false,
  hosted_by_supabase boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint email_automations_key_format check (key ~ '^[A-Z][A-Z0-9_]{1,62}$')
);

comment on table public.email_automations is
  'Enable/disable transactional mail. Does not send. Outbox remains email_outbound_events. Auth keys are hosted by Supabase.';

create or replace function public.touch_email_automations_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists email_automations_touch_updated_at on public.email_automations;
create trigger email_automations_touch_updated_at
  before update on public.email_automations
  for each row execute function public.touch_email_automations_updated_at();

alter table public.email_automations enable row level security;

drop policy if exists "email_automations_staff_select" on public.email_automations;
create policy "email_automations_staff_select" on public.email_automations
  for select to authenticated
  using (public.is_admin_portal_staff(auth.uid()));

drop policy if exists "email_automations_staff_update" on public.email_automations;
create policy "email_automations_staff_update" on public.email_automations
  for update to authenticated
  using (public.is_admin_portal_staff(auth.uid()))
  with check (public.is_admin_portal_staff(auth.uid()) and hosted_by_supabase = false);

drop policy if exists "email_automations_staff_insert" on public.email_automations;
create policy "email_automations_staff_insert" on public.email_automations
  for insert to authenticated
  with check (public.is_admin_portal_staff(auth.uid()));

revoke all on table public.email_automations from public;
grant select, insert, update on table public.email_automations to authenticated;
grant all on table public.email_automations to service_role;

insert into public.email_automations
  (key, catalog_key, name, trigger_label, recipient_type, enabled, dormant, hosted_by_supabase)
values
  ('AUTH_CONFIRMATION', 'AUTH_CONFIRMATION', 'Email confirmation', 'Supabase Auth confirmation', 'auth_supabase', false, false, true),
  ('AUTH_INVITE', 'AUTH_INVITE', 'Invite', 'Supabase Auth invite', 'auth_supabase', false, false, true),
  ('AUTH_MAGIC_LINK', 'AUTH_MAGIC_LINK', 'Magic link', 'Supabase Auth magic link', 'auth_supabase', false, false, true),
  ('AUTH_RECOVERY', 'AUTH_RECOVERY', 'Password recovery', 'Supabase Auth recovery', 'auth_supabase', false, false, true),
  ('AUTH_EMAIL_CHANGE', 'AUTH_EMAIL_CHANGE', 'Email change', 'Supabase Auth email change', 'auth_supabase', false, false, true),
  ('AUTH_REAUTHENTICATION', 'AUTH_REAUTHENTICATION', 'Reauthentication', 'Supabase Auth reauthentication', 'auth_supabase', false, false, true),
  ('RELEASE_SUBMITTED', 'RELEASE_SUBMITTED', 'Release submitted', 'Release status → submitted', 'release_owner', true, false, false),
  ('RELEASE_UNDER_REVIEW', 'RELEASE_UNDER_REVIEW', 'Release under review', 'Release status → in_qc', 'release_owner', true, false, false),
  ('RELEASE_CHANGES_REQUIRED', 'RELEASE_CHANGES_REQUIRED', 'Changes required', 'QC request changes (pre-approval)', 'release_owner', true, false, false),
  ('RELEASE_REJECTED', 'RELEASE_REJECTED', 'Release rejected', 'QC reject', 'release_owner', true, false, false),
  ('RELEASE_APPROVED', 'RELEASE_APPROVED', 'Release approved', 'QC approve / status → approved', 'release_owner', true, false, false),
  ('RELEASE_QUEUED', 'RELEASE_QUEUED', 'Release queued', 'Release status → scheduled', 'release_owner', true, false, false),
  ('RELEASE_DISTRIBUTING', 'RELEASE_DISTRIBUTING', 'Release distributing', 'Release status → delivering', 'release_owner', true, false, false),
  ('RELEASE_DELIVERED', 'RELEASE_DELIVERED', 'Release delivered', 'Provider delivery callback only', 'release_owner', false, true, false),
  ('RELEASE_LIVE', 'RELEASE_LIVE', 'Release live', 'Provider LIVE callback only', 'release_owner', false, true, false),
  ('RELEASE_FAILED', 'RELEASE_FAILED', 'Release failed', 'Release status → failed', 'release_owner', true, false, false),
  ('RELEASE_UPDATE_REQUIRED', 'RELEASE_UPDATE_REQUIRED', 'Release update required', 'Changes requested after approval', 'release_owner', true, false, false),
  ('RELEASE_TAKEDOWN_REQUESTED', 'RELEASE_TAKEDOWN_REQUESTED', 'Takedown requested', 'Release status → takedown_requested', 'release_owner', true, false, false),
  ('RELEASE_TAKEDOWN_COMPLETED', 'RELEASE_TAKEDOWN_COMPLETED', 'Takedown completed', 'Release status → taken_down', 'release_owner', true, false, false),
  ('ACCOUNT_SUSPENDED', 'ACCOUNT_SUSPENDED', 'Account suspended', 'Admin set account_status=suspended', 'account_user', true, false, false),
  ('ACCOUNT_RESTRICTED', 'ACCOUNT_RESTRICTED', 'Account restricted', 'Admin restriction applied', 'account_user', true, false, false),
  ('ACCOUNT_RESTORED', 'ACCOUNT_RESTORED', 'Account restored', 'Admin restore to active', 'account_user', true, false, false),
  ('COMPLIANCE_WARNING', 'COMPLIANCE_WARNING', 'Compliance warning', 'Staff compliance case warning', 'account_user', true, false, false),
  ('COMPLIANCE_APPEAL_RECEIVED', 'COMPLIANCE_APPEAL_RECEIVED', 'Compliance appeal received', 'Compliance appeal submitted', 'account_user', true, false, false),
  ('COMPLIANCE_APPEAL_DECISION', 'COMPLIANCE_APPEAL_DECISION', 'Compliance appeal decision', 'Staff appeal decision', 'account_user', true, false, false),
  ('SUPPORT_TICKET_CREATED', 'SUPPORT_TICKET_CREATED', 'Support ticket created', 'Portal ticket insert', 'ticket_requester', true, false, false),
  ('SUPPORT_TICKET_REPLY', 'SUPPORT_TICKET_REPLY', 'Support ticket reply', 'Staff or requester ticket reply', 'ticket_requester', true, false, false),
  ('CONTACT_ACKNOWLEDGEMENT', 'CONTACT_ACKNOWLEDGEMENT', 'Contact acknowledgement', 'Public contact form submit', 'contact_submitter', true, false, false),
  ('NEWSLETTER', 'NEWSLETTER', 'Newsletter', 'Admin newsletter campaign', 'newsletter_subscriber', true, false, false),
  ('NEW_MUSIC_FRIDAY', 'NEW_MUSIC_FRIDAY', 'New Music Friday', 'Admin NMF campaign (when sent)', 'newsletter_subscriber', true, false, false),
  ('ADMIN_NEW_ARTIST', null, 'Admin: new artist', 'Artist profile created', 'staff', false, false, false),
  ('ADMIN_NEW_LABEL', null, 'Admin: new label', 'Label profile created', 'staff', false, false, false),
  ('ADMIN_RELEASE_SUBMITTED', null, 'Admin: release submitted', 'Release submitted to QC', 'staff', false, false, false),
  ('ADMIN_QC_READY', null, 'Admin: QC ready', 'Release entered in_qc', 'staff', false, false, false),
  ('ADMIN_INQUIRY', null, 'Admin: website inquiry', 'Public contact form', 'staff', false, false, false),
  ('ADMIN_CRITICAL_FAILURE', null, 'Admin: critical failure', 'Delivery / DDEX / email failure', 'staff', false, false, false)
on conflict (key) do nothing;

create or replace function public.email_automation_allows(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select a.enabled and not a.hosted_by_supabase
      from public.email_automations a
      where a.key = p_key
    ),
    false
  );
$$;

revoke all on function public.email_automation_allows(text) from public;
grant execute on function public.email_automation_allows(text) to authenticated, service_role;
