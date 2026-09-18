-- Nexo identity verification: camera-only capture, private evidence, staff review.
do $$ begin
  create type public.identity_verification_status as enum ('draft','submitted','under_review','additional_information_required','verified','declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.identity_document_type as enum ('nin','national_id','drivers_license','passport');
exception when duplicate_object then null; end $$;

create table if not exists public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  account_type text not null check (account_type in ('artist','label')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  legal_full_name text not null,
  date_of_birth date not null,
  document_type public.identity_document_type not null,
  status public.identity_verification_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  decline_reason text,
  additional_information_request text,
  risk_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.identity_verification_evidence (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.identity_verifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('document_front','document_back','selfie')),
  storage_path text not null unique,
  captured_at timestamptz not null default now(),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 10485760),
  unique(verification_id,evidence_type)
);

create table if not exists public.identity_verification_events (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.identity_verifications(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists identity_verified_at timestamptz;
alter table public.profiles add column if not exists identity_verification_id uuid references public.identity_verifications(id) on delete set null;

create index if not exists identity_verifications_status_idx on public.identity_verifications(status, submitted_at desc);
create index if not exists identity_verification_events_verification_idx on public.identity_verification_events(verification_id, created_at desc);
create index if not exists identity_evidence_user_idx on public.identity_verification_evidence(user_id);

alter table public.identity_verifications enable row level security;
alter table public.identity_verification_evidence enable row level security;
alter table public.identity_verification_events enable row level security;

drop policy if exists "identity_verification_owner_read" on public.identity_verifications;
create policy "identity_verification_owner_read" on public.identity_verifications for select to authenticated
using ((select auth.uid()) = user_id or public.is_admin_portal_staff((select auth.uid())));

drop policy if exists "identity_verification_owner_insert" on public.identity_verifications;
create policy "identity_verification_owner_insert" on public.identity_verifications for insert to authenticated
with check ((select auth.uid()) = user_id and account_type in ('artist','label'));

drop policy if exists "identity_verification_owner_update_draft" on public.identity_verifications;
create policy "identity_verification_owner_update_draft" on public.identity_verifications for update to authenticated
using ((select auth.uid()) = user_id and status in ('draft','additional_information_required'))
with check ((select auth.uid()) = user_id and status in ('draft','additional_information_required','submitted'));

drop policy if exists "identity_evidence_owner_read" on public.identity_verification_evidence;
create policy "identity_evidence_owner_read" on public.identity_verification_evidence for select to authenticated
using ((select auth.uid()) = user_id or public.is_admin_portal_staff((select auth.uid())));

drop policy if exists "identity_evidence_owner_insert" on public.identity_verification_evidence;
create policy "identity_evidence_owner_insert" on public.identity_verification_evidence for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "identity_events_owner_read" on public.identity_verification_events;
create policy "identity_events_owner_read" on public.identity_verification_events for select to authenticated
using (
  exists(select 1 from public.identity_verifications v where v.id=verification_id and v.user_id=(select auth.uid()))
  or public.is_admin_portal_staff((select auth.uid()))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('identity-verification','identity-verification',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "identity_storage_owner_insert" on storage.objects;
create policy "identity_storage_owner_insert" on storage.objects for insert to authenticated
with check (bucket_id='identity-verification' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "identity_storage_owner_select" on storage.objects;
create policy "identity_storage_owner_select" on storage.objects for select to authenticated
using (bucket_id='identity-verification' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "identity_storage_owner_update" on storage.objects;
create policy "identity_storage_owner_update" on storage.objects for update to authenticated
using (bucket_id='identity-verification' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='identity-verification' and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.submit_identity_verification(p_verification_id uuid)
returns public.identity_verifications
language plpgsql security definer set search_path=public,storage
as $$
declare v public.identity_verifications; evidence_count int;
begin
  select * into v from public.identity_verifications where id=p_verification_id and user_id=auth.uid() for update;
  if not found then raise exception 'Verification not found' using errcode='P0002'; end if;
  if v.status not in ('draft','additional_information_required') then raise exception 'Verification cannot be submitted in current status'; end if;
  select count(*) into evidence_count from public.identity_verification_evidence
    where verification_id=v.id and evidence_type in ('document_front','document_back','selfie');
  if evidence_count <> 3 then raise exception 'Front, back, and live selfie are required'; end if;
  update public.identity_verifications set status='submitted',submitted_at=now(),decline_reason=null,updated_at=now()
    where id=v.id returning * into v;
  insert into public.identity_verification_events(verification_id,actor_user_id,event_type)
    values(v.id,auth.uid(),'submitted');
  return v;
end $$;
revoke all on function public.submit_identity_verification(uuid) from public;
grant execute on function public.submit_identity_verification(uuid) to authenticated;

create or replace function public.review_identity_verification(p_verification_id uuid,p_status public.identity_verification_status,p_reason text default null)
returns public.identity_verifications
language plpgsql security definer set search_path=public
as $$
declare v public.identity_verifications; actor uuid:=auth.uid();
begin
  if not public.is_admin_portal_staff(actor) then raise exception 'Staff access required' using errcode='42501'; end if;
  if p_status not in ('verified','declined','additional_information_required','under_review') then raise exception 'Invalid review status'; end if;
  if p_status in ('declined','additional_information_required') and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required'; end if;
  update public.identity_verifications set status=p_status,reviewed_at=case when p_status in ('verified','declined') then now() else reviewed_at end,
    reviewed_by=actor,
    decline_reason=case when p_status='declined' then p_reason else null end,
    additional_information_request=case when p_status='additional_information_required' then p_reason else null end,
    updated_at=now()
  where id=p_verification_id returning * into v;
  if not found then raise exception 'Verification not found'; end if;
  if p_status='verified' then
    update public.profiles set identity_verified_at=now(),identity_verification_id=v.id,updated_at=now() where id=v.user_id;
  elsif p_status='declined' then
    update public.profiles set identity_verified_at=null,updated_at=now() where id=v.user_id;
  end if;
  insert into public.identity_verification_events(verification_id,actor_user_id,event_type,details)
  values(v.id,actor,'review_'||p_status::text,jsonb_build_object('reason',p_reason));
  insert into public.notifications(user_id,type,title,body,entity_type,entity_id)
  values(v.user_id,'verification_update','Identity verification updated',
    case p_status when 'verified' then 'Your identity has been verified.'
      when 'declined' then 'Your identity verification was declined. Review the reason and try again.'
      when 'additional_information_required' then 'Additional information is required for your identity verification.'
      else 'Your identity verification is under review.' end,
    'identity_verification',v.id);
  return v;
end $$;
revoke all on function public.review_identity_verification(uuid,public.identity_verification_status,text) from public;
grant execute on function public.review_identity_verification(uuid,public.identity_verification_status,text) to authenticated;

alter publication supabase_realtime add table public.identity_verifications;
alter publication supabase_realtime add table public.identity_verification_events;
