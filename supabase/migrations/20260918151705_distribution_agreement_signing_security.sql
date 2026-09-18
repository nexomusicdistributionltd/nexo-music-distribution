
create or replace function public.sign_distribution_agreement_service(
  p_user_id uuid,
  p_agreement_version text,
  p_plan_id text,
  p_commission_bps integer,
  p_signature_text text,
  p_declarations jsonb,
  p_document_html text,
  p_document_sha256 text,
  p_client_ip text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_identity public.identity_verifications;
  v_company public.distribution_agreement_company_authorizations;
  v_account_type text;
  v_expected_commission integer;
  v_existing uuid;
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'User required' using errcode='22023';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'Profile not found' using errcode='P0002';
  end if;

  if exists(select 1 from public.user_roles where user_id=p_user_id and role='label') then
    v_account_type := 'label';
  elsif exists(select 1 from public.user_roles where user_id=p_user_id and role='artist') then
    v_account_type := 'artist';
  else
    raise exception 'Artist or label role required' using errcode='42501';
  end if;

  select * into v_identity
  from public.identity_verifications
  where user_id = p_user_id
    and status = 'verified'
  order by verified_at desc nulls last
  limit 1;

  if not found or v_identity.verified_at is null then
    raise exception 'Verified identity required' using errcode='42501';
  end if;

  if v_identity.account_type is not null and v_identity.account_type <> v_account_type then
    raise exception 'Verified account type does not match account role' using errcode='22023';
  end if;

  select * into v_company
  from public.distribution_agreement_company_authorizations
  where agreement_version = p_agreement_version
    and is_active
  limit 1;

  if not found then
    raise exception 'Current agreement authorization not found' using errcode='P0002';
  end if;

  if lower(regexp_replace(btrim(coalesce(p_signature_text,'')), '\s+', ' ', 'g'))
     <> lower(regexp_replace(btrim(v_identity.legal_name), '\s+', ' ', 'g')) then
    raise exception 'Signature must match verified legal name' using errcode='22023';
  end if;

  if coalesce(p_declarations->>'owns_rights','false') <> 'true'
     or coalesce(p_declarations->>'has_authority','false') <> 'true'
     or coalesce(p_declarations->>'accepts_fraud_policy','false') <> 'true'
     or coalesce(p_declarations->>'accepts_electronic_signature','false') <> 'true' then
    raise exception 'All agreement declarations are required' using errcode='22023';
  end if;

  v_expected_commission :=
    case
      when p_plan_id is null or p_plan_id = 'artist_starter' then 2000
      else 1000
    end;

  if p_commission_bps <> v_expected_commission then
    raise exception 'Commission does not match current plan classification' using errcode='22023';
  end if;

  if p_document_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid document hash' using errcode='22023';
  end if;

  if char_length(coalesce(p_document_html,'')) < 500 then
    raise exception 'Executed agreement document is incomplete' using errcode='22023';
  end if;

  select id into v_existing
  from public.distribution_agreement_executions
  where user_id=p_user_id
    and agreement_version=p_agreement_version
    and status='signed'
  limit 1;

  if v_existing is not null then
    update public.profiles
    set distribution_agreement_id=v_existing,
        distribution_agreement_signed_at=coalesce(distribution_agreement_signed_at, now()),
        updated_at=now()
    where id=p_user_id;
    return v_existing;
  end if;

  insert into public.distribution_agreement_executions(
    user_id,
    verification_id,
    company_authorization_id,
    agreement_version,
    account_type,
    legal_name,
    display_name,
    verified_email,
    country_code,
    plan_id,
    commission_bps,
    declarations,
    signature_method,
    signature_text,
    client_ip,
    user_agent,
    verification_approved_at,
    client_signed_at,
    document_html,
    document_sha256,
    status
  ) values (
    p_user_id,
    v_identity.id,
    v_company.id,
    p_agreement_version,
    v_account_type,
    v_identity.legal_name,
    v_profile.display_name,
    v_profile.email,
    v_identity.country_code,
    p_plan_id,
    p_commission_bps,
    p_declarations,
    'typed',
    btrim(p_signature_text),
    nullif(btrim(coalesce(p_client_ip,'')),''),
    nullif(btrim(coalesce(p_user_agent,'')),''),
    v_identity.verified_at,
    now(),
    p_document_html,
    p_document_sha256,
    'signed'
  )
  returning id into v_id;

  update public.profiles
  set distribution_agreement_id=v_id,
      distribution_agreement_signed_at=now(),
      updated_at=now()
  where id=p_user_id;

  insert into public.notifications(user_id,type,title,body,entity_type,entity_id)
  values(
    p_user_id,
    'agreement_update'::public.notification_type,
    'Distribution agreement signed',
    'Your Nexo distribution agreement has been signed and recorded.',
    'distribution_agreement',
    v_id
  )
  on conflict do nothing;

  return v_id;
end;
$$;

revoke all on function public.sign_distribution_agreement_service(
  uuid,text,text,integer,text,jsonb,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.sign_distribution_agreement_service(
  uuid,text,text,integer,text,jsonb,text,text,text,text
) to service_role;

revoke execute on function public.publish_notification_broadcast_admin(uuid) from public, anon;
grant execute on function public.publish_notification_broadcast_admin(uuid) to authenticated, service_role;

revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.is_admin_portal_staff(uuid) from anon;
revoke execute on function public.is_staff(uuid) from anon;
revoke execute on function public.label_manages_artist(uuid) from anon;
revoke execute on function public.label_owns_profile(uuid) from anon;
revoke execute on function public.owns_release(uuid) from anon;
revoke execute on function public.release_is_editable(uuid) from anon;
revoke execute on function public.storage_object_release_mutable(text) from anon;

create index if not exists distribution_agreement_company_authorized_by_idx
  on public.distribution_agreement_company_authorizations(authorized_by);
create index if not exists distribution_agreement_execution_company_idx
  on public.distribution_agreement_executions(company_authorization_id);
create index if not exists distribution_agreement_execution_verification_idx
  on public.distribution_agreement_executions(verification_id);
create index if not exists distribution_agreement_execution_voided_by_idx
  on public.distribution_agreement_executions(voided_by);
create index if not exists profiles_distribution_agreement_idx
  on public.profiles(distribution_agreement_id);
create index if not exists notification_broadcast_created_by_idx
  on public.notification_broadcasts(created_by);
create index if not exists payout_methods_updated_by_admin_idx
  on public.payout_methods(updated_by_admin);
