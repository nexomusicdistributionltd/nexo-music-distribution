-- Final portal/admin completion: agreements, payout methods, broadcasts, CMS realtime.
-- Additive and fail-closed. Sensitive agreement artifacts remain in private Storage.

do $$
begin
  alter type public.notification_type add value if not exists 'verification_update';
  alter type public.notification_type add value if not exists 'agreement_update';
  alter type public.notification_type add value if not exists 'broadcast';
end $$;

alter table public.profiles
  add column if not exists distribution_agreement_id uuid,
  add column if not exists distribution_agreement_signed_at timestamptz;

alter table public.notifications
  add column if not exists action_path text;

alter table public.artist_profiles
  add column if not exists entzopedia_url text;

create table if not exists public.distribution_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  verification_id uuid not null references public.identity_verifications(id) on delete restrict,
  account_type text not null check (account_type in ('artist','label')),
  agreement_version text not null default '1.1',
  legal_name text not null,
  display_name text,
  verified_email text not null,
  country_code text not null,
  plan_id text,
  commission_bps integer not null check (commission_bps in (1000,2000)),
  signature_method text not null check (signature_method in ('typed','drawn')),
  typed_signature text,
  signature_path text,
  pdf_path text,
  acceptance_flags jsonb not null default '{}'::jsonb,
  verification_approved_at timestamptz not null,
  signed_at timestamptz not null default now(),
  nexo_executed_at timestamptz not null default now(),
  signer_ip inet,
  user_agent text,
  document_sha256 text check (document_sha256 is null or document_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'signed' check (status in ('signed','superseded','revoked')),
  created_at timestamptz not null default now(),
  unique(user_id, agreement_version)
);

create index if not exists distribution_agreements_user_idx
  on public.distribution_agreements(user_id, signed_at desc);

alter table public.distribution_agreements enable row level security;
drop policy if exists "distribution_agreement_owner_read" on public.distribution_agreements;
create policy "distribution_agreement_owner_read"
  on public.distribution_agreements for select to authenticated
  using ((select auth.uid()) = user_id or public.is_staff((select auth.uid())));
revoke insert, update, delete on public.distribution_agreements from anon, authenticated;
grant select on public.distribution_agreements to authenticated;

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
      references public.distribution_agreements(id)
      on delete set null;
  end if;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'distribution-agreements',
  'distribution-agreements',
  false,
  15728640,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "agreement_storage_owner_staff_read" on storage.objects;
create policy "agreement_storage_owner_staff_read"
  on storage.objects for select to authenticated
  using (
    bucket_id='distribution-agreements'
    and (
      (storage.foldername(name))[1]=(select auth.uid())::text
      or public.is_staff((select auth.uid()))
    )
  );

-- No browser write policy: signed artifacts are written by authenticated server-side service role only.

create table if not exists public.payout_methods (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  method_type text not null check (method_type in ('bank_transfer','paypal','payoneer','wise','mobile_money','stripe','rthyms','other')),
  label text not null,
  destination_mask text,
  details jsonb not null default '{}'::jsonb,
  is_preferred boolean not null default false,
  source text not null default 'user' check (source in ('user','admin','provider')),
  provider_name text,
  provider_recipient_id text,
  status text not null default 'active' check (status in ('pending','active','disabled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payout_methods_owner_idx
  on public.payout_methods(owner_user_id, is_preferred desc, created_at desc);

create unique index if not exists payout_methods_one_preferred_idx
  on public.payout_methods(owner_user_id)
  where is_preferred and status <> 'disabled';

alter table public.payout_methods enable row level security;
drop policy if exists "payout_methods_staff_read" on public.payout_methods;
create policy "payout_methods_staff_read"
  on public.payout_methods for select to authenticated
  using (public.is_staff((select auth.uid())));
revoke all on public.payout_methods from anon, authenticated;
grant select on public.payout_methods to authenticated;

create table if not exists public.notification_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  body text not null check (char_length(btrim(body)) between 2 and 12000),
  action_path text,
  audience text not null default 'all' check (audience in ('all','artists','labels')),
  recipient_count integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.notification_broadcasts enable row level security;
drop policy if exists "notification_broadcast_staff_read" on public.notification_broadcasts;
create policy "notification_broadcast_staff_read"
  on public.notification_broadcasts for select to authenticated
  using (public.is_staff((select auth.uid())));
revoke insert, update, delete on public.notification_broadcasts from anon, authenticated;
grant select on public.notification_broadcasts to authenticated;

create or replace function public.require_distribution_agreement_before_submission()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  owner_id uuid;
begin
  select owner_user_id into owner_id from public.releases where id=new.release_id;
  if owner_id is null then return new; end if;

  if exists (
    select 1 from public.user_roles
    where user_id=owner_id and role in ('artist','label')
  ) and not exists (
    select 1 from public.distribution_agreements
    where user_id=owner_id and status='signed'
  ) then
    raise exception 'Distribution agreement must be signed before release submission'
      using errcode='42501';
  end if;
  return new;
end;
$$;

revoke all on function public.require_distribution_agreement_before_submission()
from public,anon,authenticated;

drop trigger if exists release_submission_requires_agreement on public.release_submissions;
create trigger release_submission_requires_agreement
  before insert on public.release_submissions
  for each row execute function public.require_distribution_agreement_before_submission();

do $$
begin
  begin alter publication supabase_realtime add table public.distribution_agreements;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.payout_methods;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notification_broadcasts;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.website_partners;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.blog_posts;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.cms_pages;
  exception when duplicate_object then null; end;
end $$;
