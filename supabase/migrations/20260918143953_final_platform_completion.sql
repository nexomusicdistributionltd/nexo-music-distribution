
-- Final platform completion: agreements, payout methods, broadcasts, Entzopedia link.
-- Additive and RLS-first. No provider/payment secrets are stored here.

do $$
begin
  begin alter type public.notification_type add value if not exists 'verification_update'; exception when duplicate_object then null; end;
  begin alter type public.notification_type add value if not exists 'broadcast'; exception when duplicate_object then null; end;
  begin alter type public.notification_type add value if not exists 'agreement_update'; exception when duplicate_object then null; end;
end $$;

create table if not exists public.distribution_agreement_company_authorizations (
  id uuid primary key default gen_random_uuid(),
  agreement_version text not null unique,
  template_sha256 text not null,
  authorized_legal_name text not null,
  authorized_title text not null,
  authorization_source text not null,
  authorized_by uuid null references public.profiles(id) on delete set null,
  authorized_at timestamptz not null default now(),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agreement_company_version_len check (char_length(agreement_version) between 1 and 40),
  constraint agreement_company_hash_format check (template_sha256 ~ '^[a-f0-9]{64}$')
);

create table if not exists public.distribution_agreement_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  verification_id uuid not null references public.identity_verifications(id) on delete restrict,
  company_authorization_id uuid not null references public.distribution_agreement_company_authorizations(id) on delete restrict,
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
  constraint agreement_execution_hash_format check (document_sha256 ~ '^[a-f0-9]{64}$'),
  constraint agreement_execution_signature check (
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

alter table public.profiles
  add column if not exists distribution_agreement_signed_at timestamptz,
  add column if not exists distribution_agreement_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='profiles_distribution_agreement_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_distribution_agreement_id_fkey
      foreign key (distribution_agreement_id)
      references public.distribution_agreement_executions(id)
      on delete set null;
  end if;
end $$;

alter table public.artist_profiles
  add column if not exists entzopedia_url text;

create table if not exists public.payout_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  method_type text not null check (method_type in ('bank_transfer','paypal','payoneer','mobile_money','other')),
  display_name text not null,
  country_code text,
  currency char(3),
  beneficiary_name text not null,
  details jsonb not null default '{}'::jsonb,
  provider text not null default 'manual',
  external_method_id text,
  is_preferred boolean not null default false,
  status text not null default 'active' check (status in ('active','disabled','verification_required')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_admin uuid references public.profiles(id) on delete set null,
  constraint payout_method_display_len check (char_length(btrim(display_name)) between 2 and 120),
  constraint payout_method_beneficiary_len check (char_length(btrim(beneficiary_name)) between 2 and 200)
);
create index if not exists payout_methods_user_idx on public.payout_methods(user_id, is_preferred desc, created_at desc);
create unique index if not exists payout_methods_one_preferred_uidx
  on public.payout_methods(user_id) where is_preferred and status='active';

create table if not exists public.notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all','artists','labels')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  recipient_count integer not null default 0,
  constraint notification_broadcast_title_len check (char_length(btrim(title)) between 2 and 160),
  constraint notification_broadcast_body_len check (char_length(btrim(body)) between 2 and 20000)
);
create unique index if not exists notifications_broadcast_recipient_uidx
  on public.notifications(user_id, entity_id)
  where entity_type='broadcast';

create or replace function public.touch_payout_methods_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists payout_methods_touch on public.payout_methods;
create trigger payout_methods_touch before update on public.payout_methods
for each row execute function public.touch_payout_methods_updated_at();

create or replace function public.has_current_distribution_agreement(p_user_id uuid)
returns boolean
language sql stable security definer set search_path=public
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
revoke all on function public.has_current_distribution_agreement(uuid) from public;
grant execute on function public.has_current_distribution_agreement(uuid) to authenticated, service_role;

create or replace function public.enforce_distribution_agreement_on_release()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.owner_user_id is null then return new; end if;
  if exists (
    select 1 from public.user_roles ur
    where ur.user_id=new.owner_user_id and ur.role in ('artist','label')
  ) and not public.has_current_distribution_agreement(new.owner_user_id) then
    raise exception 'Current Nexo distribution agreement must be signed before creating or distributing releases'
      using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.enforce_distribution_agreement_on_release() from public;
drop trigger if exists releases_require_distribution_agreement_insert on public.releases;
create trigger releases_require_distribution_agreement_insert
before insert on public.releases
for each row execute function public.enforce_distribution_agreement_on_release();
drop trigger if exists releases_require_distribution_agreement_status on public.releases;
create trigger releases_require_distribution_agreement_status
before update of status on public.releases
for each row
when (old.status is distinct from new.status)
execute function public.enforce_distribution_agreement_on_release();

create or replace function public.publish_notification_broadcast_admin(p_broadcast_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  b public.notification_broadcasts;
  actor uuid := auth.uid();
  inserted_count integer := 0;
begin
  if actor is null or not exists (
    select 1 from public.user_roles ur
    where ur.user_id=actor and ur.role in ('admin','super_admin')
  ) then
    raise exception 'Administrator permission required' using errcode='42501';
  end if;

  select * into b from public.notification_broadcasts where id=p_broadcast_id for update;
  if not found then raise exception 'Broadcast not found' using errcode='P0002'; end if;
  if b.published_at is not null then return b.recipient_count; end if;

  insert into public.notifications(user_id,type,title,body,entity_type,entity_id)
  select distinct ur.user_id, 'broadcast'::public.notification_type, b.title, b.body, 'broadcast', b.id
  from public.user_roles ur
  where ur.role in ('artist','label')
    and (
      b.audience='all'
      or (b.audience='artists' and ur.role='artist')
      or (b.audience='labels' and ur.role='label')
    )
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  update public.notification_broadcasts
  set published_at=now(), recipient_count=inserted_count
  where id=b.id;

  return inserted_count;
end $$;
revoke all on function public.publish_notification_broadcast_admin(uuid) from public;
grant execute on function public.publish_notification_broadcast_admin(uuid) to authenticated;

alter table public.distribution_agreement_company_authorizations enable row level security;
alter table public.distribution_agreement_executions enable row level security;
alter table public.payout_methods enable row level security;
alter table public.notification_broadcasts enable row level security;

drop policy if exists agreement_company_staff_select on public.distribution_agreement_company_authorizations;
create policy agreement_company_staff_select on public.distribution_agreement_company_authorizations
for select to authenticated using (public.is_admin_portal_staff(auth.uid()));

drop policy if exists agreement_execution_owner_staff_select on public.distribution_agreement_executions;
create policy agreement_execution_owner_staff_select on public.distribution_agreement_executions
for select to authenticated using (user_id=auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists payout_methods_owner_staff_select on public.payout_methods;
create policy payout_methods_owner_staff_select on public.payout_methods
for select to authenticated using (user_id=auth.uid() or public.is_admin_portal_staff(auth.uid()));

drop policy if exists notification_broadcast_staff_select on public.notification_broadcasts;
create policy notification_broadcast_staff_select on public.notification_broadcasts
for select to authenticated using (public.is_admin_portal_staff(auth.uid()));

revoke all on public.distribution_agreement_company_authorizations from public, anon, authenticated;
revoke all on public.distribution_agreement_executions from public, anon, authenticated;
revoke all on public.payout_methods from public, anon, authenticated;
revoke all on public.notification_broadcasts from public, anon, authenticated;
grant select on public.distribution_agreement_company_authorizations to authenticated;
grant select on public.distribution_agreement_executions to authenticated;
grant select on public.payout_methods to authenticated;
grant select on public.notification_broadcasts to authenticated;
grant all on public.distribution_agreement_company_authorizations to service_role;
grant all on public.distribution_agreement_executions to service_role;
grant all on public.payout_methods to service_role;
grant all on public.notification_broadcasts to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'distribution-agreements','distribution-agreements',false,5242880,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update
set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists agreement_storage_owner_select on storage.objects;
create policy agreement_storage_owner_select on storage.objects
for select to authenticated
using (
  bucket_id='distribution-agreements'
  and (storage.foldername(name))[1]=auth.uid()::text
);

insert into public.distribution_agreement_company_authorizations(
  agreement_version,template_sha256,authorized_legal_name,authorized_title,
  authorization_source,authorized_by,authorized_at,is_active,metadata
) values (
  'v1.1',
  'c1e4f5253379e955c28943a8f31d3d333bd49e8cbbc8e7aba158f14a95c4b68d',
  'ADEMONRIN SAMUEL KAYODE',
  'Founder',
  'uploaded_preexecuted_agreement_v1.1',
  null,
  now(),
  true,
  jsonb_build_object(
    'company','NEXO MUSIC DISTRIBUTION LTD',
    'rc','9253866',
    'registered_address','55 Moses Ajulo St, Ojokoro, Lagos, Nigeria 112104'
  )
)
on conflict (agreement_version) do update set
  template_sha256=excluded.template_sha256,
  authorized_legal_name=excluded.authorized_legal_name,
  authorized_title=excluded.authorized_title,
  authorization_source=excluded.authorization_source,
  is_active=true,
  metadata=excluded.metadata;

do $$
begin
  begin alter publication supabase_realtime add table public.payout_methods; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notification_broadcasts; exception when duplicate_object then null; end;
end $$;
