-- Focused recovery for admin functional roles + public branded contact mailboxes.
-- This migration is intentionally additive/idempotent. It does not change base
-- app roles, catalog data, royalties, release status, or provider delivery.

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
  ('distribution','Distribution','Operate provider release delivery, provider status, catalog migration and distribution sync.',40,true,true),
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

insert into public.staff_role_permissions(role_key,permission)
values
  ('support','admin:access'),('support','admin:dashboard'),('support','admin:directory'),
  ('support','admin:releases'),('support','admin:artists'),('support','admin:labels'),
  ('support','admin:support'),('support','admin:contact'),('support','admin:search'),

  ('quality_control','admin:access'),('quality_control','admin:dashboard'),
  ('quality_control','admin:directory'),('quality_control','admin:releases'),
  ('quality_control','admin:qc'),('quality_control','admin:artists'),
  ('quality_control','admin:labels'),('quality_control','admin:search'),

  ('release_operations','admin:access'),('release_operations','admin:dashboard'),
  ('release_operations','admin:directory'),('release_operations','admin:releases'),
  ('release_operations','admin:artists'),('release_operations','admin:labels'),
  ('release_operations','admin:search'),

  ('distribution','admin:access'),('distribution','admin:dashboard'),
  ('distribution','admin:directory'),('distribution','admin:releases'),
  ('distribution','admin:artists'),('distribution','admin:labels'),
  ('distribution','admin:distribution'),('distribution','admin:analytics'),
  ('distribution','admin:search'),

  ('ddex_delivery','admin:access'),('ddex_delivery','admin:dashboard'),
  ('ddex_delivery','admin:directory'),('ddex_delivery','admin:releases'),
  ('ddex_delivery','admin:distribution'),('ddex_delivery','admin:ddex'),

  ('finance','admin:access'),('finance','admin:dashboard'),('finance','admin:directory'),
  ('finance','admin:finance'),('finance','admin:statements'),('finance','admin:reports'),
  ('finance','admin:analytics'),

  ('royalties','admin:access'),('royalties','admin:dashboard'),
  ('royalties','admin:directory'),('royalties','admin:royalties'),
  ('royalties','admin:splitshare'),('royalties','admin:statements'),
  ('royalties','admin:analytics'),

  ('payouts','admin:access'),('payouts','admin:dashboard'),
  ('payouts','admin:directory'),('payouts','admin:payouts'),

  ('publishing','admin:access'),('publishing','admin:dashboard'),
  ('publishing','admin:directory'),('publishing','admin:publishing'),
  ('publishing','admin:artists'),('publishing','admin:labels'),
  ('publishing','admin:search'),

  ('compliance','admin:access'),('compliance','admin:dashboard'),
  ('compliance','admin:directory'),('compliance','admin:compliance'),
  ('compliance','admin:releases'),('compliance','admin:artists'),
  ('compliance','admin:labels'),('compliance','admin:search'),

  ('analytics','admin:access'),('analytics','admin:dashboard'),
  ('analytics','admin:analytics'),('analytics','admin:reports'),

  ('billing','admin:access'),('billing','admin:dashboard'),
  ('billing','admin:directory'),('billing','admin:billing_tools'),

  ('communications','admin:access'),('communications','admin:dashboard'),
  ('communications','admin:directory'),('communications','admin:emails'),
  ('communications','admin:newsletter'),('communications','admin:notifications'),
  ('communications','admin:contact'),

  ('website','admin:access'),('website','admin:dashboard'),
  ('website','admin:website'),

  ('marketing','admin:access'),('marketing','admin:dashboard'),
  ('marketing','admin:directory'),('marketing','admin:marketing'),
  ('marketing','admin:analytics'),('marketing','admin:notifications'),

  ('auditor','admin:access'),('auditor','admin:dashboard'),
  ('auditor','admin:audit'),('auditor','admin:reports'),
  ('auditor','admin:analytics')
on conflict do nothing;

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
as $$
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
$$;

revoke all on function public.set_staff_team_roles(uuid,text[]) from public;
grant execute on function public.set_staff_team_roles(uuid,text[]) to authenticated;

update public.website_settings
set value =
  coalesce(value,'{}'::jsonb)
  || jsonb_build_object(
    'contact_email','support@nexomusicdistribution.com',
    'inquiries_email','support@nexomusicdistribution.com',
    'support_email','support@nexomusicdistribution.com',
    'dmca_email','dmca@nexomusicdistribution.com'
  ),
  updated_at=now()
where key='footer';

update public.cms_pages
set body_html =
      '<h2>Reach us</h2>' ||
      '<p><strong>NEXO MUSIC DISTRIBUTION LTD</strong></p>' ||
      '<p>Public website: <a href="https://nexomusicdistribution.com">nexomusicdistribution.com</a></p>' ||
      '<p>Artist &amp; label support: <a href="mailto:support@nexomusicdistribution.com">support@nexomusicdistribution.com</a></p>' ||
      '<p>DMCA / copyright notices: <a href="mailto:dmca@nexomusicdistribution.com">dmca@nexomusicdistribution.com</a></p>' ||
      '<p>You can also use the message form on this page.</p>',
    status='published'::public.cms_page_status,
    published_at=coalesce(published_at,now()),
    updated_at=now()
where slug='contact';
