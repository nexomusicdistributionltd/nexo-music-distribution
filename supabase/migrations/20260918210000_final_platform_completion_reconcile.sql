-- Final platform completion reconciliation.
-- Idempotent source-of-truth migration for environments created from the repository.
-- Production already received equivalent migrations. No private company signature record is seeded here.

-- ---------------------------------------------------------------------------
-- Distribution agreement execution
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists distribution_agreement_signed_at timestamptz,
  add column if not exists distribution_agreement_id uuid;

create table if not exists public.distribution_agreement_company_authorizations (
  id uuid primary key default gen_random_uuid(),
  agreement_version text not null unique,
  template_sha256 text not null,
  authorized_legal_name text not null,
  authorized_title text not null,
  authorization_source text not null,
  authorized_by uuid references public.profiles(id) on delete set null,
  authorized_at timestamptz not null default now(),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agreement_company_hash_format
    check (template_sha256 ~ '^[a-f0-9]{64}$'),
  constraint agreement_company_version_len
    check (char_length(agreement_version) between 1 and 40)
);

create table if not exists public.distribution_agreement_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  verification_id uuid not null references public.identity_verifications(id) on delete restrict,
  company_authorization_id uuid not null
    references public.distribution_agreement_company_authorizations(id) on delete restrict,
  agreement_version text not null,
  account_type text not null check (account_type in ('artist','label')),
  legal_name text not null,
  display_name text,
  verified_email text not null,
  country_code text not null,
  plan_id text,
  commission_bps integer not null check (commission_bps in (1000,2000)),
  declarations jsonb not null,
  signature_method text not null check (signature_method in ('typed','drawn')),
  signature_text text,
  signature_storage_path text,
  client_ip text,
  user_agent text,
  verification_approved_at timestamptz not null,
  client_signed_at timestamptz not null default now(),
  document_html text not null,
  document_sha256 text not null,
  status text not null default 'signed' check (status in ('signed','void')),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  void_reason text,
  created_at timestamptz not null default now(),
  constraint agreement_execution_hash_format
    check (document_sha256 ~ '^[a-f0-9]{64}$'),
  constraint agreement_execution_signature
    check (
      (signature_method='typed' and nullif(btrim(signature_text),'') is not null)
      or
      (signature_method='drawn' and nullif(btrim(signature_storage_path),'') is not null)
    )
);

create unique index if not exists distribution_agreement_one_active_version_uidx
  on public.distribution_agreement_executions(user_id, agreement_version)
  where status='signed';

create index if not exists distribution_agreement_user_idx
  on public.distribution_agreement_executions(user_id, client_signed_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname='profiles_distribution_agreement_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_distribution_agreement_id_fkey
      foreign key (distribution_agreement_id)
      references public.distribution_agreement_executions(id)
      on delete set null;
  end if;
end
$$;

alter table public.distribution_agreement_company_authorizations enable row level security;
alter table public.distribution_agreement_executions enable row level security;

revoke all on public.distribution_agreement_company_authorizations from anon, authenticated;
revoke all on public.distribution_agreement_executions from anon, authenticated;
grant select on public.distribution_agreement_company_authorizations to authenticated;
grant select on public.distribution_agreement_executions to authenticated;
grant all on public.distribution_agreement_company_authorizations to service_role;
grant all on public.distribution_agreement_executions to service_role;

drop policy if exists agreement_company_staff_select
  on public.distribution_agreement_company_authorizations;
create policy agreement_company_staff_select
  on public.distribution_agreement_company_authorizations
  for select to authenticated
  using (public.is_admin_portal_staff(auth.uid()));

drop policy if exists agreement_execution_owner_staff_select
  on public.distribution_agreement_executions;
create policy agreement_execution_owner_staff_select
  on public.distribution_agreement_executions
  for select to authenticated
  using (user_id=auth.uid() or public.is_admin_portal_staff(auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'distribution-agreements',
  'distribution-agreements',
  false,
  5242880,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.has_current_distribution_agreement(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.distribution_agreement_executions e
    join public.distribution_agreement_company_authorizations a
      on a.id=e.company_authorization_id
    where e.user_id=p_user_id
      and e.status='signed'
      and a.is_active
      and a.agreement_version=e.agreement_version
  );
$$;

revoke all on function public.has_current_distribution_agreement(uuid)
from public, anon;
grant execute on function public.has_current_distribution_agreement(uuid)
to authenticated, service_role;

create or replace function public.enforce_distribution_agreement_on_release()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.owner_user_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id=new.owner_user_id
      and ur.role in ('artist','label')
  ) and not public.has_current_distribution_agreement(new.owner_user_id) then
    raise exception
      'Current Nexo distribution agreement must be signed before creating or distributing releases'
      using errcode='42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_distribution_agreement_on_release()
from public, anon, authenticated;
grant execute on function public.enforce_distribution_agreement_on_release()
to service_role;

drop trigger if exists releases_require_distribution_agreement_insert on public.releases;
create trigger releases_require_distribution_agreement_insert
before insert on public.releases
for each row execute function public.enforce_distribution_agreement_on_release();

drop trigger if exists releases_require_distribution_agreement_status on public.releases;
create trigger releases_require_distribution_agreement_status
before update on public.releases
for each row
when (old.status is distinct from new.status)
execute function public.enforce_distribution_agreement_on_release();

-- ---------------------------------------------------------------------------
-- Payout destinations
-- ---------------------------------------------------------------------------
create table if not exists public.payout_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  method_type text not null
    check (method_type in ('bank_transfer','paypal','payoneer','mobile_money','other')),
  display_name text not null,
  country_code text,
  currency char(3),
  beneficiary_name text not null,
  details jsonb not null default '{}'::jsonb,
  provider text not null default 'manual',
  external_method_id text,
  is_preferred boolean not null default false,
  status text not null default 'active'
    check (status in ('active','disabled','verification_required')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_admin uuid references public.profiles(id) on delete set null,
  constraint payout_method_display_len
    check (char_length(btrim(display_name)) between 2 and 120),
  constraint payout_method_beneficiary_len
    check (char_length(btrim(beneficiary_name)) between 2 and 200)
);

create index if not exists payout_methods_user_idx
  on public.payout_methods(user_id,is_preferred desc,created_at desc);

create unique index if not exists payout_methods_one_preferred_uidx
  on public.payout_methods(user_id)
  where is_preferred and status='active';

create or replace function public.touch_payout_methods_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_payout_methods_updated_at()
from public, anon, authenticated;
grant execute on function public.touch_payout_methods_updated_at()
to service_role;

drop trigger if exists payout_methods_touch on public.payout_methods;
create trigger payout_methods_touch
before update on public.payout_methods
for each row execute function public.touch_payout_methods_updated_at();

alter table public.payout_methods enable row level security;
revoke all on public.payout_methods from anon, authenticated;
grant select on public.payout_methods to authenticated;
grant all on public.payout_methods to service_role;

drop policy if exists payout_methods_owner_staff_select on public.payout_methods;
create policy payout_methods_owner_staff_select
  on public.payout_methods
  for select to authenticated
  using (user_id=auth.uid() or public.is_admin_portal_staff(auth.uid()));

alter table public.payouts add column if not exists payout_method_id uuid;
alter table public.payout_requests add column if not exists payout_method_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.payouts'::regclass
      and conname='payouts_payout_method_id_fkey'
  ) then
    alter table public.payouts
      add constraint payouts_payout_method_id_fkey
      foreign key (payout_method_id)
      references public.payout_methods(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.payout_requests'::regclass
      and conname='payout_requests_payout_method_id_fkey'
  ) then
    alter table public.payout_requests
      add constraint payout_requests_payout_method_id_fkey
      foreign key (payout_method_id)
      references public.payout_methods(id)
      on delete set null;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Staff broadcasts
-- ---------------------------------------------------------------------------
create table if not exists public.notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all'
    check (audience in ('all','artists','labels')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  recipient_count integer not null default 0,
  constraint notification_broadcast_title_len
    check (char_length(btrim(title)) between 2 and 160),
  constraint notification_broadcast_body_len
    check (char_length(btrim(body)) between 2 and 20000)
);

alter table public.notification_broadcasts enable row level security;
revoke all on public.notification_broadcasts from anon, authenticated;
grant select on public.notification_broadcasts to authenticated;
grant all on public.notification_broadcasts to service_role;

drop policy if exists notification_broadcast_staff_select
  on public.notification_broadcasts;
create policy notification_broadcast_staff_select
  on public.notification_broadcasts
  for select to authenticated
  using (public.is_admin_portal_staff(auth.uid()));

do $$
begin
  begin
    alter publication supabase_realtime add table public.payout_methods;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notification_broadcasts;
  exception when duplicate_object then null;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- Email automation registry
-- ---------------------------------------------------------------------------
insert into public.email_automations
  (key,catalog_key,name,trigger_label,recipient_type,enabled,dormant,hosted_by_supabase,updated_at)
values
  ('IDENTITY_VERIFICATION_SUBMITTED','IDENTITY_VERIFICATION_SUBMITTED','Identity verification submitted','Live identity verification submitted','account_user',true,false,false,now()),
  ('IDENTITY_VERIFICATION_APPROVED','IDENTITY_VERIFICATION_APPROVED','Identity verification approved','Admin approves identity verification','account_user',true,false,false,now()),
  ('IDENTITY_VERIFICATION_DECLINED','IDENTITY_VERIFICATION_DECLINED','Identity verification declined','Admin declines identity verification','account_user',true,false,false,now()),
  ('IDENTITY_VERIFICATION_INFO_REQUIRED','IDENTITY_VERIFICATION_INFO_REQUIRED','Identity information required','Admin requests additional identity information','account_user',true,false,false,now()),
  ('AGREEMENT_SIGNED','AGREEMENT_SIGNED','Distribution agreement signed','Client signs distribution agreement','account_user',true,false,false,now())
on conflict (key) do update
set catalog_key=excluded.catalog_key,
    name=excluded.name,
    trigger_label=excluded.trigger_label,
    recipient_type=excluded.recipient_type,
    enabled=excluded.enabled,
    dormant=excluded.dormant,
    hosted_by_supabase=excluded.hosted_by_supabase,
    updated_at=now();

-- ---------------------------------------------------------------------------
-- Atomic payout-method binding
-- ---------------------------------------------------------------------------
create or replace function public.create_payout_request_with_method(
  p_owner_user_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_payout_method_id uuid,
  p_idempotency_key text default null
)
returns public.payouts
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_method public.payout_methods;
  v_created public.payouts;
  v_currency text := upper(btrim(coalesce(p_currency,'')));
  v_mask text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select *
  into v_method
  from public.payout_methods
  where id=p_payout_method_id
    and user_id=p_owner_user_id
    and status='active'
  for share;

  if not found then
    raise exception 'An active approved payout method is required' using errcode='22023';
  end if;

  if length(v_currency) <> 3 then
    raise exception 'ISO currency required' using errcode='22023';
  end if;

  if v_method.currency is not null
     and upper(btrim(v_method.currency::text)) <> v_currency then
    raise exception 'Payout method currency does not match payout currency' using errcode='22023';
  end if;

  v_created := public.create_payout_request(
    p_owner_user_id,
    p_amount_minor,
    v_currency::char(3),
    v_method.method_type || ': ' || v_method.display_name,
    p_idempotency_key
  );

  v_mask := coalesce(
    nullif(v_method.details->>'destination_mask',''),
    v_method.display_name
  );

  update public.payouts
  set payout_method_id=v_method.id,
      destination_mask=v_mask,
      updated_at=now()
  where id=v_created.id
  returning * into v_created;

  return v_created;
end;
$$;

revoke all on function public.create_payout_request_with_method(uuid,bigint,text,uuid,text)
from public, anon;
grant execute on function public.create_payout_request_with_method(uuid,bigint,text,uuid,text)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Atomic admin broadcasts
-- ---------------------------------------------------------------------------
create or replace function public.publish_notification_broadcast(
  p_title text,
  p_body text,
  p_audience text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  actor uuid := auth.uid();
  v_id uuid;
  v_count integer := 0;
  v_title text := btrim(coalesce(p_title,''));
  v_body text := btrim(coalesce(p_body,''));
  v_audience text := lower(btrim(coalesce(p_audience,'all')));
begin
  if actor is null or not public.is_admin_portal_staff(actor) then
    raise exception 'Administrator permission required' using errcode='42501';
  end if;

  if char_length(v_title) < 2 or char_length(v_title) > 160 then
    raise exception 'Title must be 2-160 characters' using errcode='22023';
  end if;
  if char_length(v_body) < 2 or char_length(v_body) > 20000 then
    raise exception 'Body must be 2-20000 characters' using errcode='22023';
  end if;
  if v_audience not in ('all','artists','labels') then
    raise exception 'Invalid broadcast audience' using errcode='22023';
  end if;

  insert into public.notification_broadcasts(title,body,audience,created_by)
  values(v_title,v_body,v_audience,actor)
  returning id into v_id;

  insert into public.notifications(user_id,type,title,body,entity_type,entity_id)
  select
    p.id,
    'broadcast'::public.notification_type,
    v_title,
    v_body,
    'notification_broadcast',
    v_id
  from public.profiles p
  where p.account_type in ('artist','label')
    and p.account_status in ('active','pending_verification')
    and (
      v_audience='all'
      or (v_audience='artists' and p.account_type='artist')
      or (v_audience='labels' and p.account_type='label')
    );

  get diagnostics v_count=row_count;

  update public.notification_broadcasts
  set recipient_count=v_count,
      published_at=now()
  where id=v_id;

  return jsonb_build_object('id',v_id,'recipient_count',v_count);
end;
$$;

revoke all on function public.publish_notification_broadcast(text,text,text)
from public, anon;
grant execute on function public.publish_notification_broadcast(text,text,text)
to authenticated, service_role;
