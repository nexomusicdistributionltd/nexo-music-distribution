-- Reconcile the generic transactional email enqueue guard on already-migrated databases.
-- Signed-in non-staff users may only enqueue email tied to their own user id.
-- Explicit recipient addresses are reserved for staff and trusted service-role flows.

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

  if resolved_user_id is null
     and auth.uid() is not null
     and not public.is_staff(auth.uid()) then
    raise exception 'Explicit recipient transactional email requires staff or service role'
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
