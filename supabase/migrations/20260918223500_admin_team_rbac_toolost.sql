-- NEXO staff team RBAC.
-- Keeps public.app_role stable (support/admin/super_admin) and adds composable
-- functional teams for least-privilege access across the admin portal.

create table if not exists public.staff_roles (
  role_key text primary key,
  name text not null,
  description text not null default '',
  sort_order integer not null default 100,
  is_active boolean not null default true,
  is_system boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_roles_key_format check (role_key ~ '^[a-z][a-z0-9_]{1,63}$')
);

create table if not exists public.staff_role_permissions (
  role_key text not null references public.staff_roles(role_key) on delete cascade,
  permission text not null,
  created_at timestamptz not null default now(),
  primary key (role_key, permission),
  constraint staff_role_permissions_format check (permission ~ '^admin:[a-z0-9_:]+$')
);

create table if not exists public.staff_role_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_key text not null references public.staff_roles(role_key) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_key)
);

create index if not exists staff_role_assignments_role_idx
  on public.staff_role_assignments(role_key, created_at desc);

insert into public.staff_roles
  (role_key,name,description,sort_order,is_active,is_system)
values
  ('support','Customer Support','Support tickets, website messages, user lookup and release context. No finance, provider delivery or settings.',10,true,true),
  ('quality_control','Quality Control','Review release metadata/assets, approve or return releases for corrections.',20,true,true),
  ('release_operations','Release Operations','Manage release records, artist/label catalog context and operational corrections.',30,true,true),
  ('distribution','Distribution','Operate TooLost release delivery, provider status, catalog migration and distribution sync.',40,true,true),
  ('ddex_delivery','DDEX Delivery','Generate, validate, package and deliver DDEX messages and review acknowledgements.',50,true,true),
  ('finance','Finance','Finance overview, statements, reconciliations and finance reporting.',60,true,true),
  ('royalties','Royalties & SplitShare','Royalty reporting, SplitShare, statements and earnings analytics.',70,true,true),
  ('payouts','Payout Operations','Review payout requests and payout methods without staff-role administration.',80,true,true),
  ('publishing','Publishing','Publishing works, parties, shares and registrations.',90,true,true),
  ('compliance','Compliance & Verification','Identity verification, agreements, fraud/compliance cases and evidence.',100,true,true),
  ('analytics','Analytics & Reports','Platform analytics and operational reports.',110,true,true),
  ('billing','Billing','Artist/label plan and billing administration without general finance access.',120,true,true),
  ('communications','Communications','Admin email center, newsletter, notifications and website contact replies.',130,true,true),
  ('website','Website & CMS','Website settings, artists/releases showcase, partners, blog, pages, videos and CMS media.',140,true,true),
  ('marketing','Marketing','Playlist pitching, campaign-facing analytics and promotional operations.',150,true,true),
  ('auditor','Auditor','Audit trail, reporting and analytics visibility without staff or distribution administration.',160,true,true)
on conflict (role_key) do update set
  name=excluded.name,
  description=excluded.description,
  sort_order=excluded.sort_order,
  is_active=excluded.is_active,
  is_system=excluded.is_system,
  updated_at=now();

delete from public.staff_role_permissions
where role_key in ('support','quality_control','release_operations','distribution','ddex_delivery','finance','royalties','payouts','publishing','compliance','analytics','billing','communications','website','marketing','auditor');

insert into public.staff_role_permissions(role_key,permission)
values
  ('support','admin:access'),
  ('support','admin:dashboard'),
  ('support','admin:directory'),
  ('support','admin:releases'),
  ('support','admin:artists'),
  ('support','admin:labels'),
  ('support','admin:support'),
  ('support','admin:contact'),
  ('support','admin:search'),
  ('quality_control','admin:access'),
  ('quality_control','admin:dashboard'),
  ('quality_control','admin:directory'),
  ('quality_control','admin:releases'),
  ('quality_control','admin:qc'),
  ('quality_control','admin:artists'),
  ('quality_control','admin:labels'),
  ('quality_control','admin:search'),
  ('release_operations','admin:access'),
  ('release_operations','admin:dashboard'),
  ('release_operations','admin:directory'),
  ('release_operations','admin:releases'),
  ('release_operations','admin:artists'),
  ('release_operations','admin:labels'),
  ('release_operations','admin:search'),
  ('distribution','admin:access'),
  ('distribution','admin:dashboard'),
  ('distribution','admin:directory'),
  ('distribution','admin:releases'),
  ('distribution','admin:artists'),
  ('distribution','admin:labels'),
  ('distribution','admin:distribution'),
  ('distribution','admin:analytics'),
  ('distribution','admin:search'),
  ('ddex_delivery','admin:access'),
  ('ddex_delivery','admin:dashboard'),
  ('ddex_delivery','admin:directory'),
  ('ddex_delivery','admin:releases'),
  ('ddex_delivery','admin:distribution'),
  ('ddex_delivery','admin:ddex'),
  ('finance','admin:access'),
  ('finance','admin:dashboard'),
  ('finance','admin:directory'),
  ('finance','admin:finance'),
  ('finance','admin:statements'),
  ('finance','admin:reports'),
  ('finance','admin:analytics'),
  ('royalties','admin:access'),
  ('royalties','admin:dashboard'),
  ('royalties','admin:directory'),
  ('royalties','admin:royalties'),
  ('royalties','admin:splitshare'),
  ('royalties','admin:statements'),
  ('royalties','admin:analytics'),
  ('payouts','admin:access'),
  ('payouts','admin:dashboard'),
  ('payouts','admin:directory'),
  ('payouts','admin:payouts'),
  ('publishing','admin:access'),
  ('publishing','admin:dashboard'),
  ('publishing','admin:directory'),
  ('publishing','admin:publishing'),
  ('publishing','admin:artists'),
  ('publishing','admin:labels'),
  ('publishing','admin:search'),
  ('compliance','admin:access'),
  ('compliance','admin:dashboard'),
  ('compliance','admin:directory'),
  ('compliance','admin:compliance'),
  ('compliance','admin:releases'),
  ('compliance','admin:artists'),
  ('compliance','admin:labels'),
  ('compliance','admin:search'),
  ('analytics','admin:access'),
  ('analytics','admin:dashboard'),
  ('analytics','admin:analytics'),
  ('analytics','admin:reports'),
  ('billing','admin:access'),
  ('billing','admin:dashboard'),
  ('billing','admin:directory'),
  ('billing','admin:billing_tools'),
  ('communications','admin:access'),
  ('communications','admin:dashboard'),
  ('communications','admin:directory'),
  ('communications','admin:emails'),
  ('communications','admin:newsletter'),
  ('communications','admin:notifications'),
  ('communications','admin:contact'),
  ('website','admin:access'),
  ('website','admin:dashboard'),
  ('website','admin:website'),
  ('marketing','admin:access'),
  ('marketing','admin:dashboard'),
  ('marketing','admin:directory'),
  ('marketing','admin:marketing'),
  ('marketing','admin:analytics'),
  ('marketing','admin:notifications'),
  ('auditor','admin:access'),
  ('auditor','admin:dashboard'),
  ('auditor','admin:audit'),
  ('auditor','admin:reports'),
  ('auditor','admin:analytics')
on conflict do nothing;

-- Existing support accounts keep their current useful support access after RBAC ships.
insert into public.staff_role_assignments(user_id,role_key,assigned_by)
select ur.user_id,'support',null
from public.user_roles ur
where ur.role='support'
on conflict do nothing;

alter table public.staff_roles enable row level security;
alter table public.staff_role_permissions enable row level security;
alter table public.staff_role_assignments enable row level security;

drop policy if exists staff_roles_read on public.staff_roles;
create policy staff_roles_read on public.staff_roles
  for select to authenticated using (true);

drop policy if exists staff_role_permissions_read on public.staff_role_permissions;
create policy staff_role_permissions_read on public.staff_role_permissions
  for select to authenticated using (true);

drop policy if exists staff_role_assignments_read on public.staff_role_assignments;
create policy staff_role_assignments_read on public.staff_role_assignments
  for select to authenticated
  using (
    user_id=auth.uid()
    or public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'super_admin')
  );

drop policy if exists staff_role_assignments_admin_write on public.staff_role_assignments;
create policy staff_role_assignments_admin_write on public.staff_role_assignments
  for all to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'super_admin')
  )
  with check (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'super_admin')
  );

create or replace function public.has_staff_permission(uid uuid, p_permission text)
returns boolean
language sql
stable
security invoker
set search_path=public
as $$
  select case
    when uid is null or p_permission is null then false
    when p_permission='admin:roles' then public.has_role(uid,'super_admin')
    when p_permission='admin:payouts:mark_paid' then false
    when public.has_role(uid,'super_admin') or public.has_role(uid,'admin') then true
    when not public.has_role(uid,'support') then false
    else exists (
      select 1
      from public.staff_role_assignments a
      join public.staff_roles r on r.role_key=a.role_key and r.is_active=true
      join public.staff_role_permissions rp on rp.role_key=a.role_key
      where a.user_id=uid and rp.permission=p_permission
    )
  end;
$$;

revoke all on function public.has_staff_permission(uuid,text) from public;
grant execute on function public.has_staff_permission(uuid,text) to anon, authenticated, service_role;

create or replace function public.current_staff_permissions()
returns text[]
language sql
stable
security invoker
set search_path=public
as $$
  select coalesce(array_agg(distinct rp.permission order by rp.permission),array[]::text[])
  from public.staff_role_assignments a
  join public.staff_roles r on r.role_key=a.role_key and r.is_active=true
  join public.staff_role_permissions rp on rp.role_key=a.role_key
  where a.user_id=auth.uid();
$$;

revoke all on function public.current_staff_permissions() from public;
grant execute on function public.current_staff_permissions() to authenticated;

create or replace function public.set_staff_team_roles(
  p_target uuid,
  p_role_keys text[]
)
returns integer
language plpgsql
security definer
set search_path=public
as $team$
declare
  actor uuid := auth.uid();
  normalized text[];
  expected integer := 0;
  actual integer := 0;
begin
  if actor is null or not (
    public.has_role(actor,'admin')
    or public.has_role(actor,'super_admin')
  ) then
    raise exception 'Administrator permission required' using errcode='42501';
  end if;

  if p_target is null then
    raise exception 'Target user required' using errcode='22023';
  end if;

  if not exists (
    select 1 from public.user_roles
    where user_id=p_target and role='support'
  ) or exists (
    select 1 from public.user_roles
    where user_id=p_target and role in ('admin','super_admin')
  ) then
    raise exception 'Functional team roles apply to support staff accounts only'
      using errcode='42501';
  end if;

  select coalesce(array_agg(distinct trim(value) order by trim(value)),array[]::text[])
  into normalized
  from unnest(coalesce(p_role_keys,array[]::text[])) value
  where nullif(trim(value),'') is not null;

  expected := cardinality(normalized);

  if expected > 0 then
    select count(*) into actual
    from public.staff_roles
    where role_key=any(normalized) and is_active=true;

    if actual <> expected then
      raise exception 'One or more staff team roles are invalid or inactive'
        using errcode='22023';
    end if;
  end if;

  delete from public.staff_role_assignments where user_id=p_target;

  insert into public.staff_role_assignments(user_id,role_key,assigned_by)
  select p_target,role_key,actor
  from unnest(normalized) role_key
  on conflict do nothing;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values (
    actor,
    'role_change',
    'staff_team_roles',
    p_target,
    jsonb_build_object('team_roles',normalized)
  );

  return expected;
end;
$team$;

revoke all on function public.set_staff_team_roles(uuid,text[]) from public;
grant execute on function public.set_staff_team_roles(uuid,text[]) to authenticated;

-- Restrict staff-role metadata mutation to Super Admin. Team assignments are
-- intentionally writable by Admin and Super Admin so Admin can manage staff.
drop policy if exists staff_roles_super_admin_write on public.staff_roles;
create policy staff_roles_super_admin_write on public.staff_roles
  for all to authenticated
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

drop policy if exists staff_role_permissions_super_admin_write on public.staff_role_permissions;
create policy staff_role_permissions_super_admin_write on public.staff_role_permissions
  for all to authenticated
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- Core directory and catalog visibility.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:directory'));

drop policy if exists "artist_profiles_select_own" on public.artist_profiles;
create policy "artist_profiles_select_own" on public.artist_profiles
  for select to authenticated
  using (
    user_id=auth.uid()
    or public.label_manages_artist(id)
    or public.has_staff_permission(auth.uid(),'admin:directory')
  );

drop policy if exists "label_profiles_select_own" on public.label_profiles;
create policy "label_profiles_select_own" on public.label_profiles
  for select to authenticated
  using (user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:directory'));

drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles
  for select to authenticated
  using (
    user_id=auth.uid()
    or public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'super_admin')
  );

drop policy if exists "releases_select_own_or_staff" on public.releases;
create policy "releases_select_own_or_staff" on public.releases
  for select to authenticated
  using (owner_user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:releases'));

drop policy if exists "releases_update_own" on public.releases;
create policy "releases_update_own" on public.releases
  for update to authenticated
  using (owner_user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:releases'))
  with check (owner_user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:releases'));

drop policy if exists "release_tracks_all_own" on public.release_tracks;
create policy "release_tracks_all_own" on public.release_tracks
  for all to authenticated
  using (public.owns_release(release_id) or public.has_staff_permission(auth.uid(),'admin:releases'))
  with check (public.owns_release(release_id) or public.has_staff_permission(auth.uid(),'admin:releases'));

drop policy if exists "release_assets_all_own" on public.release_assets;
create policy "release_assets_all_own" on public.release_assets
  for all to authenticated
  using (public.owns_release(release_id) or public.has_staff_permission(auth.uid(),'admin:releases'))
  with check (public.owns_release(release_id) or public.has_staff_permission(auth.uid(),'admin:releases'));

drop policy if exists "release_status_history_select" on public.release_status_history;
create policy "release_status_history_select" on public.release_status_history
  for select to authenticated
  using (public.owns_release(release_id) or public.has_staff_permission(auth.uid(),'admin:releases'));

-- QC
drop policy if exists "qc_queue_staff_select" on public.qc_queue_items;
create policy "qc_queue_staff_select" on public.qc_queue_items
  for select to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:qc'));

drop policy if exists "qc_reviews_staff_select" on public.qc_reviews;
create policy "qc_reviews_staff_select" on public.qc_reviews
  for select to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:qc'));

-- Support/contact
drop policy if exists "contact_messages_staff" on public.contact_messages;
create policy "contact_messages_staff" on public.contact_messages
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:contact'))
  with check (public.has_staff_permission(auth.uid(),'admin:contact'));

drop policy if exists "support_tickets_select" on public.support_tickets;
create policy "support_tickets_select" on public.support_tickets
  for select to authenticated
  using (
    requester_user_id=auth.uid()
    or public.has_staff_permission(auth.uid(),'admin:support')
  );

drop policy if exists "support_tickets_update_staff" on public.support_tickets;
create policy "support_tickets_update_staff" on public.support_tickets
  for update to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:support'))
  with check (public.has_staff_permission(auth.uid(),'admin:support'));

drop policy if exists "support_messages_select" on public.support_messages;
create policy "support_messages_select" on public.support_messages
  for select to authenticated
  using (
    public.has_staff_permission(auth.uid(),'admin:support')
    or (
      is_internal=false and exists (
        select 1 from public.support_tickets t
        where t.id=ticket_id and t.requester_user_id=auth.uid()
      )
    )
  );

drop policy if exists "support_messages_insert" on public.support_messages;
create policy "support_messages_insert" on public.support_messages
  for insert to authenticated
  with check (
    author_user_id=auth.uid() and (
      public.has_staff_permission(auth.uid(),'admin:support')
      or (
        is_internal=false and exists (
          select 1 from public.support_tickets t
          where t.id=ticket_id and t.requester_user_id=auth.uid()
        )
      )
    )
  );

-- Compliance / verification.
drop policy if exists "compliance_cases_staff" on public.compliance_cases;
create policy "compliance_cases_staff" on public.compliance_cases
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:compliance'))
  with check (public.has_staff_permission(auth.uid(),'admin:compliance'));

drop policy if exists "compliance_evidence_staff" on public.compliance_evidence;
create policy "compliance_evidence_staff" on public.compliance_evidence
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:compliance'))
  with check (public.has_staff_permission(auth.uid(),'admin:compliance'));

drop policy if exists "identity_verifications_select_own_or_staff" on public.identity_verifications;
create policy "identity_verifications_select_own_or_staff" on public.identity_verifications
  for select to authenticated
  using (auth.uid()=user_id or public.has_staff_permission(auth.uid(),'admin:compliance'));

drop policy if exists "identity_submissions_select_own_or_staff" on public.identity_verification_submissions;
create policy "identity_submissions_select_own_or_staff" on public.identity_verification_submissions
  for select to authenticated
  using (auth.uid()=user_id or public.has_staff_permission(auth.uid(),'admin:compliance'));

drop policy if exists "identity_risk_staff_read" on public.identity_verification_risk_signals;
create policy "identity_risk_staff_read" on public.identity_verification_risk_signals
  for select to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:compliance'));

-- TooLost / Distribution Engine operational data.
drop policy if exists "distribution_jobs_select" on public.distribution_jobs;
create policy "distribution_jobs_select" on public.distribution_jobs
  for select to authenticated
  using (
    public.owns_release(release_id)
    or public.has_staff_permission(auth.uid(),'admin:distribution')
  );

drop policy if exists "distribution_retries_select" on public.distribution_retries;
create policy "distribution_retries_select" on public.distribution_retries
  for select to authenticated
  using (
    public.owns_release(release_id)
    or public.has_staff_permission(auth.uid(),'admin:distribution')
  );

drop policy if exists "provider_submissions_select" on public.provider_submissions;
create policy "provider_submissions_select" on public.provider_submissions
  for select to authenticated
  using (
    public.owns_release(release_id)
    or public.has_staff_permission(auth.uid(),'admin:distribution')
  );

drop policy if exists "provider_webhook_events_staff_select" on public.provider_webhook_events;
create policy "provider_webhook_events_staff_select" on public.provider_webhook_events
  for select to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:distribution'));

drop policy if exists "provider_sync_runs_select" on public.provider_sync_runs;
create policy "provider_sync_runs_select" on public.provider_sync_runs
  for select to authenticated
  using (
    (release_id is not null and public.owns_release(release_id))
    or public.has_staff_permission(auth.uid(),'admin:distribution')
  );

-- DDEX
drop policy if exists "ddex_messages_staff_select" on public.ddex_messages;
create policy "ddex_messages_staff_select" on public.ddex_messages
  for select to authenticated using (public.has_staff_permission(auth.uid(),'admin:ddex'));
drop policy if exists "ddex_messages_staff_write" on public.ddex_messages;
create policy "ddex_messages_staff_write" on public.ddex_messages
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:ddex'))
  with check (public.has_staff_permission(auth.uid(),'admin:ddex'));

drop policy if exists "ddex_validation_runs_staff_select" on public.ddex_validation_runs;
create policy "ddex_validation_runs_staff_select" on public.ddex_validation_runs
  for select to authenticated using (public.has_staff_permission(auth.uid(),'admin:ddex'));
drop policy if exists "ddex_validation_runs_staff_write" on public.ddex_validation_runs;
create policy "ddex_validation_runs_staff_write" on public.ddex_validation_runs
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:ddex'))
  with check (public.has_staff_permission(auth.uid(),'admin:ddex'));

drop policy if exists "ddex_delivery_attempts_staff_all" on public.ddex_delivery_attempts;
create policy "ddex_delivery_attempts_staff_all" on public.ddex_delivery_attempts
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:ddex'))
  with check (public.has_staff_permission(auth.uid(),'admin:ddex'));

drop policy if exists "ddex_acknowledgments_staff_all" on public.ddex_acknowledgments;
create policy "ddex_acknowledgments_staff_all" on public.ddex_acknowledgments
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:ddex'))
  with check (public.has_staff_permission(auth.uid(),'admin:ddex'));

drop policy if exists "dsp_targets_staff_select" on public.dsp_targets;
create policy "dsp_targets_staff_select" on public.dsp_targets
  for select to authenticated using (public.has_staff_permission(auth.uid(),'admin:ddex'));
drop policy if exists "dsp_targets_staff_write" on public.dsp_targets;
create policy "dsp_targets_staff_write" on public.dsp_targets
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:ddex'))
  with check (public.has_staff_permission(auth.uid(),'admin:ddex'));

-- Finance / royalties / payouts.
drop policy if exists "ledger_accounts_select" on public.ledger_accounts;
create policy "ledger_accounts_select" on public.ledger_accounts
  for select to authenticated
  using (
    owner_user_id=auth.uid()
    or public.has_staff_permission(auth.uid(),'admin:finance')
    or public.has_staff_permission(auth.uid(),'admin:royalties')
    or public.has_staff_permission(auth.uid(),'admin:payouts')
  );

drop policy if exists "ledger_entries_select" on public.ledger_entries;
create policy "ledger_entries_select" on public.ledger_entries
  for select to authenticated
  using (
    owner_user_id=auth.uid()
    or public.has_staff_permission(auth.uid(),'admin:finance')
    or public.has_staff_permission(auth.uid(),'admin:royalties')
    or public.has_staff_permission(auth.uid(),'admin:payouts')
  );

drop policy if exists "royalty_statements_select" on public.royalty_statements;
create policy "royalty_statements_select" on public.royalty_statements
  for select to authenticated
  using (
    (owner_user_id=auth.uid() and status='published')
    or public.has_staff_permission(auth.uid(),'admin:statements')
    or public.has_staff_permission(auth.uid(),'admin:royalties')
  );

drop policy if exists "payouts_select" on public.payouts;
create policy "payouts_select" on public.payouts
  for select to authenticated
  using (owner_user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:payouts'));

drop policy if exists "royalty_import_batches_staff" on public.royalty_import_batches;
create policy "royalty_import_batches_staff" on public.royalty_import_batches
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:royalties'))
  with check (public.has_staff_permission(auth.uid(),'admin:royalties'));

drop policy if exists "royalty_import_rows_staff" on public.royalty_import_rows;
create policy "royalty_import_rows_staff" on public.royalty_import_rows
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:royalties'))
  with check (public.has_staff_permission(auth.uid(),'admin:royalties'));

-- Publishing.
drop policy if exists "publishing_works_select" on public.publishing_works;
create policy "publishing_works_select" on public.publishing_works
  for select to authenticated
  using (owner_user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:publishing'));
drop policy if exists "publishing_works_write" on public.publishing_works;
create policy "publishing_works_write" on public.publishing_works
  for all to authenticated
  using (owner_user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:publishing'))
  with check (owner_user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:publishing'));

-- Billing.
drop policy if exists "billing_customers_select_own" on public.billing_customers;
create policy "billing_customers_select_own" on public.billing_customers
  for select to authenticated
  using (user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:billing_tools'));
drop policy if exists "billing_subscriptions_select_own" on public.billing_subscriptions;
create policy "billing_subscriptions_select_own" on public.billing_subscriptions
  for select to authenticated
  using (user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:billing_tools'));
drop policy if exists "billing_transactions_select_own" on public.billing_transactions;
create policy "billing_transactions_select_own" on public.billing_transactions
  for select to authenticated
  using (user_id=auth.uid() or public.has_staff_permission(auth.uid(),'admin:billing_tools'));
drop policy if exists "billing_webhook_events_staff_select" on public.billing_webhook_events;
create policy "billing_webhook_events_staff_select" on public.billing_webhook_events
  for select to authenticated using (public.has_staff_permission(auth.uid(),'admin:billing_tools'));
drop policy if exists "billing_checkout_intents_staff_select" on public.billing_checkout_intents;
create policy "billing_checkout_intents_staff_select" on public.billing_checkout_intents
  for select to authenticated using (public.has_staff_permission(auth.uid(),'admin:billing_tools'));

-- Communications.
drop policy if exists "email_events_staff" on public.email_outbound_events;
create policy "email_events_staff" on public.email_outbound_events
  for select to authenticated using (public.has_staff_permission(auth.uid(),'admin:emails'));

drop policy if exists "email_templates_staff_select" on public.email_templates;
create policy "email_templates_staff_select" on public.email_templates
  for select to authenticated using (public.has_staff_permission(auth.uid(),'admin:emails'));
drop policy if exists "email_templates_staff_insert" on public.email_templates;
create policy "email_templates_staff_insert" on public.email_templates
  for insert to authenticated with check (public.has_staff_permission(auth.uid(),'admin:emails'));
drop policy if exists "email_templates_staff_update" on public.email_templates;
create policy "email_templates_staff_update" on public.email_templates
  for update to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:emails'))
  with check (public.has_staff_permission(auth.uid(),'admin:emails'));
drop policy if exists "email_templates_staff_delete" on public.email_templates;
create policy "email_templates_staff_delete" on public.email_templates
  for delete to authenticated using (public.has_staff_permission(auth.uid(),'admin:emails'));

drop policy if exists "email_automations_staff_select" on public.email_automations;
create policy "email_automations_staff_select" on public.email_automations
  for select to authenticated using (public.has_staff_permission(auth.uid(),'admin:emails'));
drop policy if exists "email_automations_staff_insert" on public.email_automations;
create policy "email_automations_staff_insert" on public.email_automations
  for insert to authenticated with check (public.has_staff_permission(auth.uid(),'admin:emails'));
drop policy if exists "email_automations_staff_update" on public.email_automations;
create policy "email_automations_staff_update" on public.email_automations
  for update to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:emails'))
  with check (public.has_staff_permission(auth.uid(),'admin:emails') and hosted_by_supabase=false);

drop policy if exists "newsletter_subscribers_staff_all" on public.newsletter_subscribers;
create policy "newsletter_subscribers_staff_all" on public.newsletter_subscribers
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:newsletter'))
  with check (public.has_staff_permission(auth.uid(),'admin:newsletter'));
drop policy if exists "newsletter_campaigns_staff_all" on public.newsletter_campaigns;
create policy "newsletter_campaigns_staff_all" on public.newsletter_campaigns
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:newsletter'))
  with check (public.has_staff_permission(auth.uid(),'admin:newsletter'));
drop policy if exists "newsletter_recipients_staff_all" on public.newsletter_campaign_recipients;
create policy "newsletter_recipients_staff_all" on public.newsletter_campaign_recipients
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:newsletter'))
  with check (public.has_staff_permission(auth.uid(),'admin:newsletter'));

-- Website / CMS.
drop policy if exists "blog_posts_public_select" on public.blog_posts;
create policy "blog_posts_public_select" on public.blog_posts
  for select to anon,authenticated
  using (status='published' or public.has_staff_permission(auth.uid(),'admin:website'));
drop policy if exists "blog_posts_staff_all" on public.blog_posts;
create policy "blog_posts_staff_all" on public.blog_posts
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:website'))
  with check (public.has_staff_permission(auth.uid(),'admin:website'));

drop policy if exists "cms_pages_public_select" on public.cms_pages;
create policy "cms_pages_public_select" on public.cms_pages
  for select to anon,authenticated
  using (status='published' or public.has_staff_permission(auth.uid(),'admin:website'));
drop policy if exists "cms_pages_staff_all" on public.cms_pages;
create policy "cms_pages_staff_all" on public.cms_pages
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:website'))
  with check (public.has_staff_permission(auth.uid(),'admin:website'));

drop policy if exists "cms_media_staff_all" on public.cms_media;
create policy "cms_media_staff_all" on public.cms_media
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:website'))
  with check (public.has_staff_permission(auth.uid(),'admin:website'));

drop policy if exists "website_partners_public_select" on public.website_partners;
create policy "website_partners_public_select" on public.website_partners
  for select to anon,authenticated
  using (is_active=true or public.has_staff_permission(auth.uid(),'admin:website'));
drop policy if exists "website_partners_staff_all" on public.website_partners;
create policy "website_partners_staff_all" on public.website_partners
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:website'))
  with check (public.has_staff_permission(auth.uid(),'admin:website'));

drop policy if exists "website_settings_staff_all" on public.website_settings;
create policy "website_settings_staff_all" on public.website_settings
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:website'))
  with check (public.has_staff_permission(auth.uid(),'admin:website'));

drop policy if exists "website_videos_public_select" on public.website_videos;
create policy "website_videos_public_select" on public.website_videos
  for select to anon,authenticated
  using (published=true or public.has_staff_permission(auth.uid(),'admin:website'));
drop policy if exists "website_videos_staff_all" on public.website_videos;
create policy "website_videos_staff_all" on public.website_videos
  for all to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:website'))
  with check (public.has_staff_permission(auth.uid(),'admin:website'));

-- Audit trail.
drop policy if exists "audit_logs_select_staff" on public.audit_logs;
create policy "audit_logs_select_staff" on public.audit_logs
  for select to authenticated using (public.has_staff_permission(auth.uid(),'admin:audit'));

-- Storage least-privilege.
drop policy if exists "cms_media_staff_insert" on storage.objects;
create policy "cms_media_staff_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id='cms-media'
    and public.has_staff_permission(auth.uid(),'admin:website')
    and (storage.foldername(name))[1]=auth.uid()::text
  );
drop policy if exists "cms_media_staff_update" on storage.objects;
create policy "cms_media_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id='cms-media' and public.has_staff_permission(auth.uid(),'admin:website'))
  with check (bucket_id='cms-media' and public.has_staff_permission(auth.uid(),'admin:website'));
drop policy if exists "cms_media_staff_delete" on storage.objects;
create policy "cms_media_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id='cms-media' and public.has_staff_permission(auth.uid(),'admin:website'));

drop policy if exists "compliance_evidence_staff" on storage.objects;
create policy "compliance_evidence_staff" on storage.objects
  for all to authenticated
  using (bucket_id='compliance-evidence' and public.has_staff_permission(auth.uid(),'admin:compliance'))
  with check (bucket_id='compliance-evidence' and public.has_staff_permission(auth.uid(),'admin:compliance'));

drop policy if exists "ddex_ern_staff_select" on storage.objects;
create policy "ddex_ern_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id='ddex-ern' and public.has_staff_permission(auth.uid(),'admin:ddex'));
drop policy if exists "ddex_ern_staff_insert" on storage.objects;
create policy "ddex_ern_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id='ddex-ern' and public.has_staff_permission(auth.uid(),'admin:ddex'));
drop policy if exists "ddex_ern_staff_update" on storage.objects;
create policy "ddex_ern_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id='ddex-ern' and public.has_staff_permission(auth.uid(),'admin:ddex'))
  with check (bucket_id='ddex-ern' and public.has_staff_permission(auth.uid(),'admin:ddex'));

drop policy if exists "ddex_packages_staff_select" on storage.objects;
create policy "ddex_packages_staff_select" on storage.objects
  for select to authenticated
  using (bucket_id='ddex-packages' and public.has_staff_permission(auth.uid(),'admin:ddex'));
drop policy if exists "ddex_packages_staff_insert" on storage.objects;
create policy "ddex_packages_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id='ddex-packages' and public.has_staff_permission(auth.uid(),'admin:ddex'));
drop policy if exists "ddex_packages_staff_update" on storage.objects;
create policy "ddex_packages_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id='ddex-packages' and public.has_staff_permission(auth.uid(),'admin:ddex'))
  with check (bucket_id='ddex-packages' and public.has_staff_permission(auth.uid(),'admin:ddex'));

drop policy if exists "identity_storage_select_own_or_staff" on storage.objects;
create policy "identity_storage_select_own_or_staff" on storage.objects
  for select to authenticated
  using (
    bucket_id='identity-verification'
    and (
      (storage.foldername(name))[1]=auth.uid()::text
      or public.has_staff_permission(auth.uid(),'admin:compliance')
    )
  );


-- Explicit Data API grants. RLS remains authoritative. Anon SELECT is needed
-- only so the invoker helper can safely resolve to false from public-read policies.
grant select on public.staff_roles, public.staff_role_permissions, public.staff_role_assignments
  to anon, authenticated, service_role;
grant insert, update, delete on public.staff_role_assignments
  to authenticated, service_role;
grant insert, update, delete on public.staff_roles, public.staff_role_permissions
  to authenticated, service_role;

-- Marketing / playlist pitching.
drop policy if exists "playlist_pitch_select" on public.playlist_pitch_requests;
create policy "playlist_pitch_select" on public.playlist_pitch_requests
  for select to authenticated
  using (
    owner_user_id=auth.uid()
    or public.has_staff_permission(auth.uid(),'admin:marketing')
  );

drop policy if exists "playlist_pitch_staff_update" on public.playlist_pitch_requests;
create policy "playlist_pitch_staff_update" on public.playlist_pitch_requests
  for update to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:marketing'))
  with check (public.has_staff_permission(auth.uid(),'admin:marketing'));

-- Notification operations. Users always keep their own rows.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (
    user_id=auth.uid()
    or public.has_staff_permission(auth.uid(),'admin:notifications')
  );

drop policy if exists "notifications_insert_staff" on public.notifications;
create policy "notifications_insert_staff" on public.notifications
  for insert to authenticated
  with check (public.has_staff_permission(auth.uid(),'admin:notifications'));

drop policy if exists "notification_broadcast_staff_select" on public.notification_broadcasts;
create policy "notification_broadcast_staff_select" on public.notification_broadcasts
  for select to authenticated
  using (public.has_staff_permission(auth.uid(),'admin:notifications'));

-- Report exports can be created/read by teams with report access.
drop policy if exists "report_exports_insert" on public.report_exports;
create policy "report_exports_insert" on public.report_exports
  for insert to authenticated
  with check (
    requested_by=auth.uid()
    and public.has_staff_permission(auth.uid(),'admin:reports')
  );

drop policy if exists "report_exports_own_or_admin" on public.report_exports;
create policy "report_exports_own_or_admin" on public.report_exports
  for select to authenticated
  using (
    requested_by=auth.uid()
    or public.has_staff_permission(auth.uid(),'admin:reports')
  );

-- Website team must never receive broad UPDATE on the releases table just to
-- change a public showcase image. This narrow RPC updates only that field.
create or replace function public.admin_set_release_cover_override(
  p_release_id uuid,
  p_cover_url text default null
)
returns public.releases
language plpgsql
security definer
set search_path=public
as $website$
declare
  actor uuid := auth.uid();
  row public.releases;
begin
  if actor is null or not public.has_staff_permission(actor,'admin:website') then
    raise exception 'Website permission required' using errcode='42501';
  end if;

  update public.releases
  set website_cover_override_url=nullif(btrim(coalesce(p_cover_url,'')),''),
      updated_at=now()
  where id=p_release_id
  returning * into row;

  if row.id is null then
    raise exception 'Release not found' using errcode='P0002';
  end if;

  perform public.write_audit_log(
    'website_publish'::public.audit_action,
    'release',
    p_release_id,
    jsonb_build_object('cover_override_changed',true)
  );
  return row;
end;
$website$;

revoke all on function public.admin_set_release_cover_override(uuid,text) from public;
grant execute on function public.admin_set_release_cover_override(uuid,text) to authenticated;
