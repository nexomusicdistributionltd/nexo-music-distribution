-- Retarget enqueue_email_event / mark_email_event_status onto the canonical
-- Batch 5 outbox public.email_outbound_events (protect_email_outbound_sent).
-- Does NOT create a third outbox. Leaves public.email_events in place as a
-- legacy PR #5 table — app + SQL triggers stop writing to it.

-- Idempotency lives in payload because email_outbound_events has no dedicated column.
create unique index if not exists email_outbound_events_idempotency_uidx
  on public.email_outbound_events ((payload->>'_idempotency_key'))
  where coalesce(payload->>'_idempotency_key', '') <> '';

comment on table public.email_outbound_events is
  'Canonical outbound email outbox. status=sent only after a real provider accept + provider_message_id (protect_email_outbound_sent). queued|skipped|failed|sent.';

comment on table public.email_events is
  'LEGACY PR #5 outbox (pending|processing|sent|failed|unavailable). Canonical writes go to public.email_outbound_events. Do not grow this table.';

-- Reject the unconfigured adapter name "null" as well as none/fake/test.
create or replace function public.protect_email_outbound_sent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'sent' then
    if new.provider is null or length(trim(new.provider)) = 0
       or new.provider_message_id is null or length(trim(new.provider_message_id)) = 0 then
      raise exception 'email status sent requires provider and provider_message_id'
        using errcode = 'P0001';
    end if;
    if lower(trim(new.provider)) in ('none', 'not_connected', 'fake', 'test', 'null') then
      raise exception 'email status sent requires a real provider' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- Same signature as PR #5 so SQL triggers and app callers stay unchanged.
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
  -- to_email is NOT NULL on the canonical table; skip rather than abort the parent txn.
  if to_addr is null then
    return null;
  end if;

  cleaned := cleaned - array[
    'token', 'access_token', 'refresh_token', 'password', 'secret',
    'service_role', 'api_key', 'authorization', 'cookie'
  ];
  cleaned := cleaned || jsonb_build_object(
    '_event_type', trim(p_event_type),
    '_idempotency_key', trim(p_idempotency_key),
    '_attempt_count', 0
  );
  if p_recipient_user_id is not null then
    cleaned := cleaned || jsonb_build_object('_recipient_user_id', p_recipient_user_id::text);
  end if;
  if p_related_release_id is not null then
    cleaned := cleaned || jsonb_build_object('_related_release_id', p_related_release_id::text);
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

-- Return type changes from email_events → email_outbound_events.
drop function if exists public.mark_email_event_status(uuid, text, text, text, text);

create function public.mark_email_event_status(
  p_id uuid,
  p_status text,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null
)
returns public.email_outbound_events
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.email_outbound_events;
  canonical public.email_event_status;
  attempts int;
begin
  canonical := case p_status
    when 'pending' then 'queued'::public.email_event_status
    when 'processing' then 'queued'::public.email_event_status
    when 'queued' then 'queued'::public.email_event_status
    when 'unavailable' then 'skipped'::public.email_event_status
    when 'skipped' then 'skipped'::public.email_event_status
    when 'failed' then 'failed'::public.email_event_status
    when 'sent' then 'sent'::public.email_event_status
    else null
  end;
  if canonical is null then
    raise exception 'Invalid status' using errcode = 'P0001';
  end if;

  select * into row from public.email_outbound_events where id = p_id for update;
  if not found then
    raise exception 'email_outbound_events row not found' using errcode = 'P0002';
  end if;

  -- Once sent, the row is immutable (never fabricate or unwind SENT).
  if row.status = 'sent' then
    return row;
  end if;

  if canonical = 'sent' then
    if p_provider_message_id is null or length(trim(p_provider_message_id)) = 0 then
      raise exception 'sent requires provider_message_id' using errcode = 'P0001';
    end if;
    if p_provider is null or length(trim(p_provider)) = 0
       or lower(trim(p_provider)) in ('none', 'not_connected', 'fake', 'test', 'null') then
      raise exception 'sent requires a real provider' using errcode = 'P0001';
    end if;
  end if;

  attempts := coalesce((row.payload->>'_attempt_count')::int, 0)
    + case when p_status in ('processing', 'queued', 'failed', 'skipped', 'unavailable', 'sent') then 1 else 0 end;

  update public.email_outbound_events
  set
    status = canonical,
    provider = coalesce(nullif(trim(coalesce(p_provider, '')), ''), provider),
    provider_message_id = coalesce(nullif(trim(coalesce(p_provider_message_id, '')), ''), provider_message_id),
    error = case when canonical in ('failed', 'skipped') then p_error else null end,
    payload = coalesce(row.payload, '{}'::jsonb) || jsonb_build_object('_attempt_count', attempts),
    updated_at = now()
  where id = p_id
  returning * into row;

  return row;
end;
$$;

revoke all on function public.mark_email_event_status(uuid, text, text, text, text) from public;
grant execute on function public.mark_email_event_status(uuid, text, text, text, text) to authenticated, service_role;
