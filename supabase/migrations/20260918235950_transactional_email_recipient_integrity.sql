-- Transactional email recipient integrity + complete release metadata payloads.
-- Purpose:
-- 1) user-scoped transactional email is always sent to the canonical profile email;
-- 2) release email is always scoped to the release owner (artist/label account owner);
-- 3) release templates receive complete, factual metadata and decision reasons;
-- 4) explicit newsletters/contact mail remain explicit-recipient flows.

create or replace function public.enqueue_email_event(
  p_event_type text,
  p_template_key text,
  p_recipient_user_id uuid default null,
  p_recipient_email text default null,
  p_related_release_id uuid default null,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  cleaned jsonb := coalesce(p_payload, '{}'::jsonb);
  actor uuid := coalesce(p_created_by, auth.uid());
  to_addr text := nullif(trim(coalesce(p_recipient_email, '')), '');
  entity_id uuid := coalesce(p_related_entity_id, p_related_release_id);
  resolved_release_id uuid := p_related_release_id;
  resolved_user_id uuid := p_recipient_user_id;
  canonical_email text;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key required' using errcode = 'P0001';
  end if;
  if p_template_key is null or length(trim(p_template_key)) = 0 then
    raise exception 'template_key required' using errcode = 'P0001';
  end if;
  if p_event_type is null or length(trim(p_event_type)) = 0 then
    raise exception 'event_type required' using errcode = 'P0001';
  end if;
  if p_template_key ~ '^AUTH_' then
    raise exception 'Auth templates are hosted by Supabase, not the outbox' using errcode = 'P0001';
  end if;

  if resolved_release_id is null and nullif(trim(coalesce(p_related_entity_type, '')), '') = 'release' then
    resolved_release_id := p_related_entity_id;
  end if;

  -- Release lifecycle/QC email can never trust a caller-supplied address.
  -- Resolve the exact release owner and canonical profile email every time.
  if resolved_release_id is not null then
    select r.owner_user_id, p.email
      into resolved_user_id, canonical_email
    from public.releases r
    join public.profiles p on p.id = r.owner_user_id
    where r.id = resolved_release_id;

    if not found or canonical_email is null or length(trim(canonical_email)) = 0 then
      return null;
    end if;

    if p_recipient_user_id is not null and p_recipient_user_id <> resolved_user_id then
      raise exception 'Transactional email recipient does not own the related release'
        using errcode = '42501';
    end if;

    to_addr := trim(canonical_email);
    entity_id := resolved_release_id;
  elsif resolved_user_id is not null then
    -- Account/verification/support transactional mail follows the affected user,
    -- not an arbitrary email supplied by an admin action.
    select p.email
      into canonical_email
    from public.profiles p
    where p.id = resolved_user_id;

    if not found or canonical_email is null or length(trim(canonical_email)) = 0 then
      return null;
    end if;
    to_addr := trim(canonical_email);
  end if;

  if to_addr is null then
    return null;
  end if;

  -- An authenticated non-staff caller may only enqueue user-scoped mail to
  -- themselves. Staff can act on the affected account; service-role calls have
  -- no auth.uid() and are trusted server-side.
  if resolved_user_id is not null
     and auth.uid() is not null
     and auth.uid() <> resolved_user_id
     and not public.is_staff(auth.uid()) then
    raise exception 'Cannot enqueue transactional email for another user'
      using errcode = '42501';
  end if;

  -- One outbox event = one mailbox. Explicit broadcasts/newsletters must enqueue
  -- one event per recipient instead of passing a recipient list in one string.
  if to_addr ~ E'[\\r\\n,;]' then
    raise exception 'Transactional email requires exactly one recipient address'
      using errcode = 'P0001';
  end if;

  cleaned := cleaned - array[
    'token', 'access_token', 'refresh_token', 'password', 'secret',
    'service_role', 'api_key', 'authorization', 'cookie', 'otp', 'otp_code'
  ];
  cleaned := cleaned || jsonb_build_object(
    '_event_type', trim(p_event_type),
    '_idempotency_key', trim(p_idempotency_key),
    '_attempt_count', 0
  );
  if resolved_user_id is not null then
    cleaned := cleaned || jsonb_build_object('_recipient_user_id', resolved_user_id::text);
  end if;
  if resolved_release_id is not null then
    cleaned := cleaned || jsonb_build_object('_related_release_id', resolved_release_id::text);
  end if;
  if actor is not null then
    cleaned := cleaned || jsonb_build_object('_created_by', actor::text);
  end if;

  insert into public.email_outbound_events (
    to_email, template_key, payload, status,
    related_entity_type, related_entity_id
  ) values (
    to_addr, trim(p_template_key), cleaned, 'queued',
    nullif(trim(coalesce(p_related_entity_type, '')), ''),
    entity_id
  )
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    return null;
end;
$$;

revoke all on function public.enqueue_email_event(
  text, text, uuid, text, uuid, text, uuid, jsonb, text, uuid
) from public;
grant execute on function public.enqueue_email_event(
  text, text, uuid, text, uuid, text, uuid, jsonb, text, uuid
) to authenticated, service_role;

create or replace function public.enqueue_release_catalog_email(
  p_release_id uuid,
  p_from public.release_status,
  p_to public.release_status,
  p_history_id uuid,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  owner_email text;
  first_name text;
  rel public.releases;
  catalog_key text;
  event_type text;
  allow_dormant boolean := false;
  meta_source text;
  payload jsonb;
  eid uuid;
  track_count bigint := 0;
  track_summary text := '';
  reason_text text := nullif(trim(coalesce(p_reason, '')), '');
begin
  catalog_key := public.catalog_key_for_release_transition(p_from, p_to);
  if catalog_key is null then
    return null;
  end if;

  if not public.email_automation_allows(catalog_key) then
    return null;
  end if;

  select * into rel from public.releases where id = p_release_id;
  if not found then
    return null;
  end if;

  select p.id, p.email, split_part(coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), p.email), ' ', 1)
    into owner_id, owner_email, first_name
  from public.profiles p
  where p.id = rel.owner_user_id;

  if owner_email is null or length(trim(owner_email)) = 0 then
    return null;
  end if;

  select
    count(*),
    coalesce(
      string_agg(
        rt.track_number::text || '. ' || coalesce(nullif(rt.title, ''), 'Untitled track') ||
        case
          when nullif(rt.isrc, '') is not null then ' — ISRC ' || rt.isrc
          else ''
        end,
        ' | ' order by rt.track_number
      ),
      ''
    )
    into track_count, track_summary
  from public.release_tracks rt
  where rt.release_id = p_release_id;

  meta_source := coalesce(p_metadata->>'source', '');
  allow_dormant := coalesce(rel.provider_connected, false)
    and meta_source in ('webhook', 'sync_release_status', 'apply_provider_sync_status');

  if catalog_key in ('RELEASE_DELIVERED', 'RELEASE_LIVE') and not allow_dormant then
    return null;
  end if;

  event_type := case
    when catalog_key in ('RELEASE_APPROVED', 'RELEASE_CHANGES_REQUIRED', 'RELEASE_REJECTED') then 'release.qc'
    when catalog_key = 'RELEASE_SUBMITTED' then 'release.submit'
    else 'release.status'
  end;

  payload := jsonb_build_object(
    'FIRST_NAME', coalesce(first_name, 'there'),
    'RELEASE_ID', rel.id::text,
    'RELEASE_TITLE', coalesce(rel.title, ''),
    'RELEASE_TYPE', initcap(coalesce(rel.release_type::text, '')),
    'RELEASE_VERSION', coalesce(rel.version, ''),
    'ARTIST_NAME', coalesce(rel.primary_artist_name, ''),
    'LABEL_NAME', coalesce(rel.label_name, ''),
    'UPC', coalesce(rel.upc, ''),
    'RELEASE_DATE', coalesce(rel.release_date::text, ''),
    'ORIGINAL_RELEASE_DATE', coalesce(rel.original_release_date::text, ''),
    'GENRE', coalesce(rel.genre, ''),
    'SUBGENRE', coalesce(rel.subgenre, ''),
    'LANGUAGE', coalesce(rel.language, ''),
    'EXPLICIT_LABEL', case when coalesce(rel.explicit, false) then 'Explicit' else 'Not explicit' end,
    'TERRITORIES', coalesce(array_to_string(rel.territories, ', '), ''),
    'COPYRIGHT_YEAR', coalesce(rel.copyright_year::text, ''),
    'COPYRIGHT_LINE', coalesce(rel.copyright_line, ''),
    'PHONOGRAM_LINE', coalesce(rel.phonogram_line, ''),
    'TRACK_COUNT', track_count::text,
    'TRACKS_SUMMARY', track_summary,
    'RELEASE_STATUS', p_to::text,
    'STATUS_LABEL', initcap(replace(p_to::text, '_', ' ')),
    'REASON', coalesce(reason_text, ''),
    'QC_NOTES', coalesce(reason_text, ''),
    'DECISION_SUMMARY',
      case
        when p_to = 'approved' then 'Nexo QC completed its review and no blocking issue was recorded for this submission.'
        when reason_text is not null then reason_text
        else initcap(replace(p_to::text, '_', ' '))
      end,
    'CTA_URL', 'https://nexomusicdistribution.com/dashboard/releases/' || p_release_id::text,
    'CTA_LABEL', 'Open release',
    'PREHEADER',
      initcap(replace(p_to::text, '_', ' ')) || ': ' ||
      coalesce(nullif(rel.title, ''), 'Release') ||
      case when nullif(rel.primary_artist_name, '') is not null then ' — ' || rel.primary_artist_name else '' end,
    '_allow_dormant', allow_dormant
  );

  eid := public.enqueue_email_event(
    event_type,
    catalog_key,
    owner_id,
    owner_email,
    p_release_id,
    'release',
    p_release_id,
    payload,
    'RELEASE_STATUS:' || p_release_id::text || ':' || p_to::text || ':' || coalesce(p_history_id::text, 'none'),
    null
  );

  return eid;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.enqueue_release_catalog_email(
  uuid, public.release_status, public.release_status, uuid, text, jsonb
) from public;
grant execute on function public.enqueue_release_catalog_email(
  uuid, public.release_status, public.release_status, uuid, text, jsonb
) to authenticated, service_role;
