-- NEXO identity verification portal hardening and verified badge sync.
-- Additive over the live identity_verification migration. Sensitive evidence stays in a private bucket.

alter table public.identity_verifications
  add column if not exists consented_at timestamptz,
  add column if not exists consent_version text;

alter table public.identity_verification_evidence
  add column if not exists capture_metadata jsonb not null default '{}'::jsonb;

alter table public.artist_profiles
  add column if not exists identity_verified boolean not null default false;

alter table public.label_profiles
  add column if not exists identity_verified boolean not null default false;

comment on column public.artist_profiles.identity_verified is
  'Public badge flag synchronized from profiles.identity_verified_at. Contains no identity document data.';
comment on column public.label_profiles.identity_verified is
  'Badge flag synchronized from profiles.identity_verified_at. Contains no identity document data.';

update public.artist_profiles a
set identity_verified = (p.identity_verified_at is not null)
from public.profiles p
where a.user_id = p.id;

update public.label_profiles l
set identity_verified = (p.identity_verified_at is not null)
from public.profiles p
where l.user_id = p.id;

create or replace function public.sync_identity_verified_badge()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.artist_profiles
  set identity_verified = (new.identity_verified_at is not null),
      updated_at = now()
  where user_id = new.id;

  update public.label_profiles
  set identity_verified = (new.identity_verified_at is not null),
      updated_at = now()
  where user_id = new.id;

  return new;
end;
$$;

drop trigger if exists profiles_sync_identity_verified_badge on public.profiles;
create trigger profiles_sync_identity_verified_badge
after update of identity_verified_at on public.profiles
for each row execute function public.sync_identity_verified_badge();

create or replace function public.save_identity_verification_details(
  p_country_code text,
  p_legal_full_name text,
  p_date_of_birth date,
  p_document_type public.identity_document_type,
  p_consent boolean
)
returns public.identity_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  account_kind text;
  v public.identity_verifications;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select account_type into account_kind
  from public.profiles
  where id = actor;

  if account_kind not in ('artist','label') then
    raise exception 'Identity verification is only available to artist and label accounts' using errcode='42501';
  end if;

  p_country_code := upper(trim(coalesce(p_country_code,'')));
  p_legal_full_name := trim(coalesce(p_legal_full_name,''));

  if p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Select a valid country';
  end if;
  if char_length(p_legal_full_name) < 2 or char_length(p_legal_full_name) > 200 then
    raise exception 'Enter the full legal name shown on the identity document';
  end if;
  if p_date_of_birth is null or p_date_of_birth > current_date or p_date_of_birth < date '1900-01-01' then
    raise exception 'Enter a valid date of birth';
  end if;
  if not coalesce(p_consent,false) then
    raise exception 'Consent is required before identity verification can continue';
  end if;

  select * into v
  from public.identity_verifications
  where user_id = actor
  for update;

  if found and v.status in ('submitted','under_review','verified') then
    raise exception 'Identity verification cannot be edited in its current status';
  end if;

  if found and v.status = 'declined' then
    -- Keep the old private storage objects and event trail for fraud/audit history,
    -- but require fresh current evidence before a new submission.
    delete from public.identity_verification_evidence
    where verification_id = v.id;

    update public.identity_verifications
    set status = 'draft',
        decline_reason = null,
        additional_information_request = null,
        reviewed_at = null,
        reviewed_by = null,
        submitted_at = null,
        updated_at = now()
    where id = v.id;
  end if;

  insert into public.identity_verifications (
    user_id,
    account_type,
    country_code,
    legal_full_name,
    date_of_birth,
    document_type,
    status,
    consented_at,
    consent_version
  )
  values (
    actor,
    account_kind,
    p_country_code,
    p_legal_full_name,
    p_date_of_birth,
    p_document_type,
    'draft',
    now(),
    '2026-09-18'
  )
  on conflict (user_id) do update
  set country_code = excluded.country_code,
      legal_full_name = excluded.legal_full_name,
      date_of_birth = excluded.date_of_birth,
      document_type = excluded.document_type,
      consented_at = now(),
      consent_version = excluded.consent_version,
      updated_at = now()
  returning * into v;

  insert into public.identity_verification_events (
    verification_id, actor_user_id, event_type, details
  )
  values (
    v.id, actor, 'details_saved',
    jsonb_build_object(
      'country_code', v.country_code,
      'document_type', v.document_type::text,
      'consent_version', v.consent_version
    )
  );

  return v;
end;
$$;

create or replace function public.record_identity_verification_evidence(
  p_verification_id uuid,
  p_evidence_type text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_capture_metadata jsonb default '{}'::jsonb
)
returns public.identity_verification_evidence
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  v public.identity_verifications;
  e public.identity_verification_evidence;
  expected_prefix text;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into v
  from public.identity_verifications
  where id = p_verification_id and user_id = actor
  for update;

  if not found then
    raise exception 'Verification not found' using errcode='P0002';
  end if;

  if v.status not in ('draft','additional_information_required') then
    raise exception 'Evidence cannot be changed in the current status';
  end if;

  if p_evidence_type not in ('document_front','document_back','selfie') then
    raise exception 'Invalid evidence type';
  end if;

  if p_mime_type not in ('image/jpeg','image/png','image/webp') then
    raise exception 'Unsupported image type';
  end if;

  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 10485760 then
    raise exception 'Image must be between 1 byte and 10MB';
  end if;

  expected_prefix := actor::text || '/' || v.id::text || '/';
  if position(expected_prefix in coalesce(p_storage_path,'')) <> 1 then
    raise exception 'Invalid evidence storage path' using errcode='42501';
  end if;

  insert into public.identity_verification_evidence (
    verification_id, user_id, evidence_type, storage_path,
    mime_type, size_bytes, capture_metadata, captured_at
  )
  values (
    v.id, actor, p_evidence_type, p_storage_path,
    p_mime_type, p_size_bytes, coalesce(p_capture_metadata,'{}'::jsonb), now()
  )
  on conflict (verification_id, evidence_type) do update
  set storage_path = excluded.storage_path,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes,
      capture_metadata = excluded.capture_metadata,
      captured_at = now()
  returning * into e;

  insert into public.identity_verification_events (
    verification_id, actor_user_id, event_type, details
  )
  values (
    v.id, actor, 'evidence_captured',
    jsonb_build_object(
      'evidence_type', p_evidence_type,
      'storage_path', p_storage_path,
      'mime_type', p_mime_type,
      'size_bytes', p_size_bytes,
      'capture', coalesce(p_capture_metadata,'{}'::jsonb)
    )
  );

  return e;
end;
$$;

create or replace function public.submit_identity_verification(p_verification_id uuid)
returns public.identity_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.identity_verifications;
  actor uuid := auth.uid();
  evidence_count int;
begin
  select * into v
  from public.identity_verifications
  where id = p_verification_id and user_id = actor
  for update;

  if not found then
    raise exception 'Verification not found' using errcode='P0002';
  end if;

  if v.status not in ('draft','additional_information_required') then
    raise exception 'Verification cannot be submitted in current status';
  end if;

  if v.consented_at is null then
    raise exception 'Identity verification consent is required';
  end if;

  select count(distinct evidence_type) into evidence_count
  from public.identity_verification_evidence
  where verification_id = v.id
    and user_id = actor
    and evidence_type in ('document_front','document_back','selfie');

  if evidence_count <> 3 then
    raise exception 'Front, back, and live selfie captures are required';
  end if;

  update public.identity_verifications
  set status = 'submitted',
      submitted_at = now(),
      reviewed_at = null,
      reviewed_by = null,
      decline_reason = null,
      additional_information_request = null,
      updated_at = now()
  where id = v.id
  returning * into v;

  insert into public.identity_verification_events (
    verification_id, actor_user_id, event_type, details
  )
  values (
    v.id, actor, 'submitted',
    jsonb_build_object('document_type', v.document_type::text, 'country_code', v.country_code)
  );

  return v;
end;
$$;

create or replace function public.review_identity_verification(
  p_verification_id uuid,
  p_status public.identity_verification_status,
  p_reason text default null
)
returns public.identity_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.identity_verifications;
  actor uuid := auth.uid();
begin
  if actor is null or not (
    public.has_role(actor,'admin') or public.has_role(actor,'super_admin')
  ) then
    raise exception 'Administrator access required' using errcode='42501';
  end if;

  if p_status not in ('verified','declined','additional_information_required','under_review') then
    raise exception 'Invalid review status';
  end if;

  if p_status in ('declined','additional_information_required')
     and nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'A reason is required';
  end if;

  update public.identity_verifications
  set status = p_status,
      reviewed_at = case when p_status in ('verified','declined') then now() else reviewed_at end,
      reviewed_by = actor,
      decline_reason = case when p_status='declined' then trim(p_reason) else null end,
      additional_information_request =
        case when p_status='additional_information_required' then trim(p_reason) else null end,
      updated_at = now()
  where id = p_verification_id
  returning * into v;

  if not found then
    raise exception 'Verification not found';
  end if;

  if p_status='verified' then
    update public.profiles
    set identity_verified_at = now(),
        identity_verification_id = v.id,
        updated_at = now()
    where id = v.user_id;
  elsif p_status='declined' then
    update public.profiles
    set identity_verified_at = null,
        identity_verification_id = v.id,
        updated_at = now()
    where id = v.user_id;
  end if;

  insert into public.identity_verification_events (
    verification_id, actor_user_id, event_type, details
  )
  values (
    v.id, actor, 'review_' || p_status::text,
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason,'')),''))
  );

  insert into public.notifications (
    user_id, type, title, body, entity_type, entity_id
  )
  values (
    v.user_id,
    'verification_update',
    'Identity verification updated',
    case p_status
      when 'verified' then 'Your identity has been verified.'
      when 'declined' then 'Your identity verification was declined. Review the reason and submit fresh verification evidence.'
      when 'additional_information_required' then 'Additional information is required for your identity verification.'
      else 'Your identity verification is under review.'
    end,
    'identity_verification',
    v.id
  );

  return v;
end;
$$;

revoke all on function public.save_identity_verification_details(text,text,date,public.identity_document_type,boolean) from public;
revoke all on function public.record_identity_verification_evidence(uuid,text,text,text,bigint,jsonb) from public;
revoke all on function public.submit_identity_verification(uuid) from public;
revoke all on function public.review_identity_verification(uuid,public.identity_verification_status,text) from public;

grant execute on function public.save_identity_verification_details(text,text,date,public.identity_document_type,boolean) to authenticated;
grant execute on function public.record_identity_verification_evidence(uuid,text,text,text,bigint,jsonb) to authenticated;
grant execute on function public.submit_identity_verification(uuid) to authenticated;
grant execute on function public.review_identity_verification(uuid,public.identity_verification_status,text) to authenticated;

-- New Data API defaults no longer auto-expose public tables. Keep only the read surface needed
-- by authenticated clients; all writes go through validated RPCs above.
revoke all on public.identity_verifications from anon;
revoke all on public.identity_verification_evidence from anon;
revoke all on public.identity_verification_events from anon;

revoke insert, update, delete, truncate, references, trigger
  on public.identity_verifications from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.identity_verification_evidence from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.identity_verification_events from authenticated;

grant select on public.identity_verifications to authenticated;
grant select on public.identity_verification_evidence to authenticated;
grant select on public.identity_verification_events to authenticated;

-- Sensitive image objects are intentionally not deletable by clients once captured.
-- Existing private-bucket INSERT/SELECT/UPDATE policies remain owner-scoped.
