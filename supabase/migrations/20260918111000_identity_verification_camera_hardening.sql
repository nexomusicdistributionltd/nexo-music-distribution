-- Identity verification hardening: camera-only evidence integrity, safe owner access,
-- realtime review state, and staff notifications.

alter table public.identity_verification_evidence
  add column if not exists capture_method text not null default 'camera',
  add column if not exists sha256 text,
  add column if not exists capture_metadata jsonb not null default '{}'::jsonb,
  add column if not exists captured_client_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'identity_evidence_capture_method_check'
      and conrelid = 'public.identity_verification_evidence'::regclass
  ) then
    alter table public.identity_verification_evidence
      add constraint identity_evidence_capture_method_check
      check (capture_method = 'camera');
  end if;
end $$;

create unique index if not exists identity_evidence_unique_hash_per_verification
  on public.identity_verification_evidence (verification_id, sha256)
  where sha256 is not null;

drop policy if exists identity_evidence_owner_insert on public.identity_verification_evidence;
create policy identity_evidence_owner_insert
on public.identity_verification_evidence
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and capture_method = 'camera'
  and exists (
    select 1
    from public.identity_verifications v
    where v.id = verification_id
      and v.user_id = (select auth.uid())
      and v.status in ('draft','additional_information_required','declined')
  )
);

drop policy if exists identity_evidence_owner_update on public.identity_verification_evidence;
create policy identity_evidence_owner_update
on public.identity_verification_evidence
for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.identity_verifications v
    where v.id = verification_id
      and v.user_id = (select auth.uid())
      and v.status in ('draft','additional_information_required','declined')
  )
)
with check (
  (select auth.uid()) = user_id
  and capture_method = 'camera'
  and exists (
    select 1
    from public.identity_verifications v
    where v.id = verification_id
      and v.user_id = (select auth.uid())
      and v.status in ('draft','additional_information_required','declined')
  )
);

drop policy if exists identity_verification_owner_update_draft on public.identity_verifications;
create policy identity_verification_owner_update_draft
on public.identity_verifications
for update to authenticated
using (
  (select auth.uid()) = user_id
  and status in ('draft','additional_information_required','declined')
)
with check (
  (select auth.uid()) = user_id
  and status in ('draft','additional_information_required','declined','submitted')
);

drop policy if exists identity_storage_owner_update on storage.objects;

create or replace function public.submit_identity_verification(p_verification_id uuid)
returns public.identity_verifications
language plpgsql
security definer
set search_path to 'public','storage'
as $$
declare
  v public.identity_verifications;
  evidence_count int;
  type_count int;
  camera_count int;
  distinct_hash_count int;
begin
  select * into v
  from public.identity_verifications
  where id = p_verification_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Verification not found' using errcode='P0002';
  end if;

  if v.status not in ('draft','additional_information_required','declined') then
    raise exception 'Verification cannot be submitted in current status';
  end if;

  if char_length(trim(v.legal_full_name)) < 3 then
    raise exception 'Full legal name is required';
  end if;

  if v.date_of_birth is null or v.date_of_birth >= current_date then
    raise exception 'A valid date of birth is required';
  end if;

  select
    count(*),
    count(distinct evidence_type),
    count(*) filter (where capture_method = 'camera'),
    count(distinct sha256) filter (where sha256 is not null)
  into evidence_count, type_count, camera_count, distinct_hash_count
  from public.identity_verification_evidence
  where verification_id = v.id
    and evidence_type in ('document_front','document_back','selfie');

  if evidence_count <> 3 or type_count <> 3 then
    raise exception 'Front, back, and live selfie are required';
  end if;

  if camera_count <> 3 then
    raise exception 'All verification evidence must be captured live with the camera';
  end if;

  if distinct_hash_count <> 3 then
    raise exception 'Each verification capture must be a distinct live image';
  end if;

  update public.identity_verifications
  set status='submitted',
      submitted_at=now(),
      reviewed_at=null,
      reviewed_by=null,
      decline_reason=null,
      additional_information_request=null,
      updated_at=now()
  where id=v.id
  returning * into v;

  insert into public.identity_verification_events(
    verification_id,actor_user_id,event_type,details
  )
  values(
    v.id,auth.uid(),'submitted',
    jsonb_build_object('camera_only',true,'evidence_count',evidence_count)
  );

  insert into public.notifications(user_id,type,title,body,entity_type,entity_id)
  select distinct ur.user_id,
         'verification_update',
         'Identity verification submitted',
         coalesce(nullif(trim(v.legal_full_name),''),'An account') || ' submitted identity verification for review.',
         'identity_verification',
         v.id
  from public.user_roles ur
  where ur.role in ('support','admin','super_admin')
    and ur.user_id <> v.user_id;

  return v;
end
$$;

create or replace function public.review_identity_verification(
  p_verification_id uuid,
  p_status public.identity_verification_status,
  p_reason text default null
)
returns public.identity_verifications
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v public.identity_verifications;
  actor uuid := auth.uid();
begin
  if not public.is_admin_portal_staff(actor) then
    raise exception 'Staff access required' using errcode='42501';
  end if;

  if p_status not in ('verified','declined','additional_information_required','under_review') then
    raise exception 'Invalid review status';
  end if;

  if p_status in ('declined','additional_information_required')
     and nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'A reason is required';
  end if;

  update public.identity_verifications
  set status=p_status,
      reviewed_at=case when p_status in ('verified','declined') then now() else reviewed_at end,
      reviewed_by=actor,
      decline_reason=case when p_status='declined' then trim(p_reason) else null end,
      additional_information_request=case when p_status='additional_information_required' then trim(p_reason) else null end,
      updated_at=now()
  where id=p_verification_id
  returning * into v;

  if not found then
    raise exception 'Verification not found';
  end if;

  if p_status='verified' then
    update public.profiles
    set identity_verified_at=now(),
        identity_verification_id=v.id,
        account_status=case
          when account_status='pending_verification' then 'active'::public.account_status
          else account_status
        end,
        updated_at=now()
    where id=v.user_id;
  elsif p_status in ('declined','additional_information_required') then
    update public.profiles
    set identity_verified_at=null,
        identity_verification_id=null,
        updated_at=now()
    where id=v.user_id;
  end if;

  insert into public.identity_verification_events(
    verification_id,actor_user_id,event_type,details
  )
  values(
    v.id,actor,'review_'||p_status::text,
    jsonb_build_object(
      'reason',case when p_status in ('declined','additional_information_required') then trim(p_reason) else null end
    )
  );

  insert into public.notifications(user_id,type,title,body,entity_type,entity_id)
  values(
    v.user_id,
    'verification_update',
    'Identity verification updated',
    case p_status
      when 'verified' then 'Your identity has been verified.'
      when 'declined' then 'Your identity verification was declined. Review the reason and submit new live captures.'
      when 'additional_information_required' then 'Additional information is required for your identity verification.'
      else 'Your identity verification is under review.'
    end,
    'identity_verification',
    v.id
  );

  return v;
end
$$;

revoke all on function public.submit_identity_verification(uuid) from public, anon;
grant execute on function public.submit_identity_verification(uuid) to authenticated;

revoke all on function public.review_identity_verification(uuid,public.identity_verification_status,text) from public, anon;
grant execute on function public.review_identity_verification(uuid,public.identity_verification_status,text) to authenticated;

grant select, insert, update on public.identity_verifications to authenticated;
grant select, insert, update on public.identity_verification_evidence to authenticated;
grant select on public.identity_verification_events to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.identity_verifications;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.identity_verification_events;
  exception when duplicate_object then null;
  end;
end $$;
