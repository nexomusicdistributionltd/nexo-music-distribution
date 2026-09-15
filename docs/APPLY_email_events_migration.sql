-- LEGACY COPY. New enqueue/send writes go to public.email_outbound_events
-- (see docs/APPLY_email_outbound_retarget.sql). Do not grow email_events.
-- Nexo Music Distribution LTD — email events outbox (Batch email architecture)
-- Status vocabulary: pending | processing | sent | failed | unavailable
-- Never fabricate SENT / LIVE. Never store auth tokens in payload.
-- Note: batch5 created public.email_event_status (queued/skipped/failed/sent) for
-- email_outbound_events. This migration introduces public.email_events with TEXT status
-- + check constraint to avoid breaking the older enum/table.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
-- Extend audit_action for email retry audits
alter type public.audit_action add value if not exists 'email_retry';

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  template_key text not null,
  recipient_user_id uuid references auth.users (id) on delete set null,
  recipient_email text,
  related_release_id uuid null references public.releases (id) on delete set null,
  related_entity_type text null,
  related_entity_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'unavailable')),
  provider text null,
  provider_message_id text null,
  error text null,
  idempotency_key text not null,
  attempt_count int not null default 0,
  created_at timestamptz not null default now(),
  processed_at timestamptz null,
  sent_at timestamptz null,
  created_by uuid null references auth.users (id) on delete set null,
  constraint email_events_idempotency_key_unique unique (idempotency_key)
);

create index if not exists email_events_status_idx on public.email_events (status);
create index if not exists email_events_created_at_idx on public.email_events (created_at desc);
create index if not exists email_events_recipient_user_id_idx on public.email_events (recipient_user_id);
create index if not exists email_events_related_release_id_idx on public.email_events (related_release_id);
create index if not exists email_events_event_type_idx on public.email_events (event_type);

comment on table public.email_events is
  'Transactional email outbox. status=sent only after a real provider accept; unavailable when no provider configured.';

-- Optional enum alias for docs / future use (does not replace text column)
do $$ begin
  create type public.email_events_status as enum (
    'pending', 'processing', 'sent', 'failed', 'unavailable'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.email_events enable row level security;

drop policy if exists "email_events_staff_select" on public.email_events;
create policy "email_events_staff_select" on public.email_events
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support')
  );

drop policy if exists "email_events_owner_select" on public.email_events;
create policy "email_events_owner_select" on public.email_events
  for select to authenticated
  using (recipient_user_id = auth.uid());

-- No direct insert/update/delete for authenticated — service role / security definer only
drop policy if exists "email_events_no_client_write" on public.email_events;

-- ---------------------------------------------------------------------------
-- enqueue_email_event
-- ---------------------------------------------------------------------------
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

  -- Strip obvious secret keys from payload
  cleaned := cleaned - array[
    'token', 'access_token', 'refresh_token', 'password', 'secret',
    'service_role', 'api_key', 'authorization', 'cookie'
  ];

  insert into public.email_events (
    event_type, template_key, recipient_user_id, recipient_email,
    related_release_id, related_entity_type, related_entity_id,
    payload, status, idempotency_key, created_by
  ) values (
    trim(p_event_type), trim(p_template_key), p_recipient_user_id, p_recipient_email,
    p_related_release_id, p_related_entity_type, p_related_entity_id,
    cleaned, 'pending', trim(p_idempotency_key), actor
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  return new_id; -- null when duplicate
end;
$$;

revoke all on function public.enqueue_email_event(
  text, text, uuid, text, uuid, text, uuid, jsonb, text, uuid
) from public;
grant execute on function public.enqueue_email_event(
  text, text, uuid, text, uuid, text, uuid, jsonb, text, uuid
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- mark_email_event_status
-- ---------------------------------------------------------------------------
create or replace function public.mark_email_event_status(
  p_id uuid,
  p_status text,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null
)
returns public.email_events
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.email_events;
  actor uuid := auth.uid();
begin
  if p_status not in ('pending', 'processing', 'sent', 'failed', 'unavailable') then
    raise exception 'Invalid status' using errcode = 'P0001';
  end if;
  -- Refuse fabricating sent without a provider message id when called by non-service paths
  -- (service role / definer can set sent after real provider accept from app layer)
  if p_status = 'sent' and (p_provider_message_id is null or length(trim(p_provider_message_id)) = 0) then
    raise exception 'sent requires provider_message_id' using errcode = 'P0001';
  end if;

  update public.email_events
  set
    status = p_status,
    provider = coalesce(p_provider, provider),
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    error = case when p_status in ('failed', 'unavailable') then p_error else null end,
    attempt_count = attempt_count + case when p_status = 'processing' then 1 else 0 end,
    processed_at = case
      when p_status in ('sent', 'failed', 'unavailable', 'processing') then now()
      else processed_at
    end,
    sent_at = case when p_status = 'sent' then now() else sent_at end
  where id = p_id
  returning * into row;

  if not found then
    raise exception 'email_events row not found' using errcode = 'P0002';
  end if;

  return row;
end;
$$;

revoke all on function public.mark_email_event_status(uuid, text, text, text, text) from public;
grant execute on function public.mark_email_event_status(uuid, text, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helper: resolve release owner email from profiles (never trust client)
-- ---------------------------------------------------------------------------
create or replace function public._email_release_owner(p_release_id uuid)
returns table (owner_id uuid, owner_email text, release_title text, artist_name text)
language sql
stable
security definer
set search_path = public
as $$
  select r.owner_user_id, p.email, r.title, r.primary_artist_name
  from public.releases r
  join public.profiles p on p.id = r.owner_user_id
  where r.id = p_release_id;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: after release status change → enqueue mapped operational email
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_email_on_release_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tmpl text;
  evt text := 'release.status';
  owner_rec record;
  idem text;
  payload jsonb;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  tmpl := case new.status::text
    when 'submitted' then 'RELEASE_SUBMITTED'
    when 'in_qc' then 'RELEASE_UNDER_REVIEW'
    when 'changes_requested' then 'RELEASE_CHANGES_REQUIRED'
    when 'rejected' then 'RELEASE_REJECTED'
    when 'approved' then 'RELEASE_APPROVED'
    when 'scheduled' then 'RELEASE_QUEUED'
    when 'delivering' then 'RELEASE_DISTRIBUTING'
    when 'delivered' then 'RELEASE_DELIVERED' -- provider-gated; still enqueue, sender must not fake
    when 'live' then 'RELEASE_LIVE'           -- only on real LIVE transition
    when 'takedown_requested' then 'RELEASE_TAKEDOWN_REQUESTED'
    when 'taken_down' then 'RELEASE_TAKEDOWN_COMPLETED'
    else null
  end;

  if tmpl is null then
    return new;
  end if;

  if new.status::text = 'submitted' then
    evt := 'release.submit';
  elsif new.status::text in ('approved', 'rejected', 'changes_requested') then
    evt := 'release.qc';
  end if;

  select * into owner_rec from public._email_release_owner(new.id);
  if owner_rec.owner_id is null then
    return new;
  end if;

  idem := tmpl || ':' || new.id::text || ':' || new.status::text;
  payload := jsonb_build_object(
    'RELEASE_TITLE', coalesce(owner_rec.release_title, ''),
    'ARTIST_NAME', coalesce(owner_rec.artist_name, ''),
    'STATUS', new.status::text,
    'RELEASE_ID', new.id::text,
    'ARTIST_VISIBLE_REASON', coalesce(new.changes_requested_reason, new.rejection_reason, ''),
    'FIRST_NAME', '',
    'CTA_URL', coalesce(current_setting('app.settings.site_url', true), 'https://nexomusicdistro.space') || '/dashboard/releases/' || new.id::text,
    'CTA_LABEL', 'View release'
  );

  perform public.enqueue_email_event(
    evt,
    tmpl,
    owner_rec.owner_id,
    owner_rec.owner_email,
    new.id,
    'release',
    new.id,
    payload,
    idem,
    auth.uid()
  );

  -- When approved and immediately scheduled elsewhere, separate status transition fires RELEASE_QUEUED
  return new;
end;
$$;

drop trigger if exists releases_enqueue_email_on_status on public.releases;
create trigger releases_enqueue_email_on_status
  after insert or update of status on public.releases
  for each row execute function public.enqueue_email_on_release_status();

-- ---------------------------------------------------------------------------
-- Wrap perform_qc_decision to enqueue with decision-scoped idempotency
-- (trigger also fires on status; dual keys are fine — distinct idempotency)
-- ---------------------------------------------------------------------------
create or replace function public.perform_qc_decision(
  p_release_id uuid,
  p_decision public.qc_decision,
  p_checklist jsonb default '{}'::jsonb,
  p_artist_visible_reason text default null,
  p_internal_note text default null
)
returns public.qc_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.releases;
  new_status public.release_status;
  review public.qc_reviews;
  tmpl text;
  owner_rec record;
begin
  if actor is null or not (
    public.has_role(actor, 'admin')
    or public.has_role(actor, 'super_admin')
    or public.has_role(actor, 'support')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into r from public.releases where id = p_release_id for update;
  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if r.status not in ('submitted', 'in_qc') then
    raise exception 'Release is not in a QC-able status' using errcode = 'P0001';
  end if;

  if p_decision = 'approve' then
    new_status := 'approved';
    tmpl := 'RELEASE_APPROVED';
  elsif p_decision = 'request_changes' then
    new_status := 'changes_requested';
    tmpl := 'RELEASE_CHANGES_REQUIRED';
    if p_artist_visible_reason is null or length(trim(p_artist_visible_reason)) = 0 then
      raise exception 'Artist-visible reason required for request_changes' using errcode = 'P0001';
    end if;
  elsif p_decision = 'reject' then
    new_status := 'rejected';
    tmpl := 'RELEASE_REJECTED';
    if p_artist_visible_reason is null or length(trim(p_artist_visible_reason)) = 0 then
      raise exception 'Artist-visible reason required for reject' using errcode = 'P0001';
    end if;
  else
    raise exception 'Invalid decision' using errcode = 'P0001';
  end if;

  if r.status = 'submitted' then
    perform public.transition_release_status(
      p_release_id, 'in_qc', null,
      jsonb_build_object('source', 'perform_qc_decision', 'phase', 'claim')
    );
  end if;

  perform public.transition_release_status(
    p_release_id,
    new_status,
    p_artist_visible_reason,
    jsonb_build_object(
      'source', 'perform_qc_decision',
      'decision', p_decision::text,
      'internal_note', coalesce(p_internal_note, ''),
      'checklist', coalesce(p_checklist, '{}'::jsonb)
    )
  );

  insert into public.qc_reviews (
    release_id, reviewer_user_id, decision, checklist,
    artist_visible_reason, internal_note, previous_status, new_status
  ) values (
    p_release_id, actor, p_decision, coalesce(p_checklist, '{}'::jsonb),
    p_artist_visible_reason, p_internal_note, r.status, new_status
  ) returning * into review;

  update public.qc_queue_items
  set status = 'completed', assigned_to = coalesce(assigned_to, actor), updated_at = now()
  where release_id = p_release_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor, 'qc_review', 'release', p_release_id,
    jsonb_build_object('decision', p_decision::text, 'new_status', new_status::text)
  );

  -- Decision-scoped enqueue (in addition to status trigger) for stable idempotency with review id
  select * into owner_rec from public._email_release_owner(p_release_id);
  if owner_rec.owner_id is not null and tmpl is not null then
    perform public.enqueue_email_event(
      'release.qc',
      tmpl,
      owner_rec.owner_id,
      owner_rec.owner_email,
      p_release_id,
      'qc_review',
      review.id,
      jsonb_build_object(
        'RELEASE_TITLE', coalesce(owner_rec.release_title, ''),
        'ARTIST_NAME', coalesce(owner_rec.artist_name, ''),
        'STATUS', new_status::text,
        'ARTIST_VISIBLE_REASON', coalesce(p_artist_visible_reason, ''),
        'RELEASE_ID', p_release_id::text,
        'CTA_URL', 'https://nexomusicdistro.space/dashboard/releases/' || p_release_id::text,
        'CTA_LABEL', 'View release'
      ),
      tmpl || ':' || p_release_id::text || ':' || new_status::text || ':' || review.id::text,
      actor
    );
  end if;

  return review;
end;
$$;

revoke all on function public.perform_qc_decision(uuid, public.qc_decision, jsonb, text, text) from public;
grant execute on function public.perform_qc_decision(uuid, public.qc_decision, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_account_status → account emails
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_account_status(
  p_target uuid,
  p_status public.account_status,
  p_reason text,
  p_restriction public.account_restriction_kind default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  p public.profiles;
  act text;
  tmpl text;
  idem text;
begin
  if actor is null or not (
    public.has_role(actor, 'admin') or public.has_role(actor, 'super_admin')
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Reason required' using errcode = 'P0001';
  end if;
  if public.has_role(p_target, 'super_admin') and not public.has_role(actor, 'super_admin') then
    raise exception 'Cannot modify super_admin' using errcode = '42501';
  end if;

  select * into p from public.profiles where id = p_target for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;

  act := case
    when p_status = 'suspended' then 'suspend'
    when p_status = 'deactivated' then 'deactivate'
    when p_status = 'active' then 'restore'
    else 'restrict'
  end;

  update public.profiles
  set account_status = p_status,
      restriction_kind = coalesce(p_restriction, restriction_kind),
      updated_at = now()
  where id = p_target
  returning * into p;

  insert into public.account_actions (target_user_id, actor_user_id, action, restriction_kind, reason)
  values (p_target, actor, act, coalesce(p_restriction, p.restriction_kind), p_reason);

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    case when act = 'restore' then 'account_restore'::public.audit_action
         when act = 'restrict' then 'account_restrict'::public.audit_action
         else 'account_suspend'::public.audit_action end,
    'profile', p_target,
    jsonb_build_object('status', p_status::text, 'reason', p_reason)
  );

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
  values (
    p_target, 'account_status',
    'Account status updated',
    'Your account status is now ' || p_status::text || '.',
    'profile', p_target
  );

  tmpl := case
    when p_status = 'suspended' then 'ACCOUNT_SUSPENDED'
    when p_status = 'active' and act = 'restore' then 'ACCOUNT_RESTORED'
    when p_restriction is not null and p_restriction::text <> 'none' then 'ACCOUNT_RESTRICTED'
    else null
  end;

  if tmpl is not null and p.email is not null then
    idem := tmpl || ':' || p_target::text || ':' || p_status::text || ':' || to_char(now(), 'YYYYMMDDHH24MI');
    perform public.enqueue_email_event(
      'account.status',
      tmpl,
      p_target,
      p.email,
      null,
      'profile',
      p_target,
      jsonb_build_object(
        'STATUS', p_status::text,
        'ARTIST_VISIBLE_REASON', p_reason,
        'FIRST_NAME', coalesce(p.display_name, p.full_name, ''),
        'CTA_URL', 'https://nexomusicdistro.space/support',
        'CTA_LABEL', 'Contact support'
      ),
      idem,
      actor
    );
  end if;

  return p;
end;
$$;

revoke all on function public.admin_set_account_status(uuid, public.account_status, text, public.account_restriction_kind) from public;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text, public.account_restriction_kind) to authenticated;

-- ---------------------------------------------------------------------------
-- Support ticket create / reply hooks (if tables exist)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_email_on_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  select id, email, display_name, full_name into req
  from public.profiles where id = new.requester_user_id;
  if req.id is null then return new; end if;

  perform public.enqueue_email_event(
    'support',
    'SUPPORT_TICKET_CREATED',
    req.id,
    req.email,
    null,
    'support_ticket',
    new.id,
    jsonb_build_object(
      'FIRST_NAME', coalesce(req.display_name, req.full_name, ''),
      'STATUS', coalesce(new.status, 'open'),
      'CTA_URL', 'https://nexomusicdistro.space/support',
      'CTA_LABEL', 'View ticket'
    ),
    'SUPPORT_TICKET_CREATED:' || new.id::text,
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists support_tickets_enqueue_email on public.support_tickets;
create trigger support_tickets_enqueue_email
  after insert on public.support_tickets
  for each row execute function public.enqueue_email_on_support_ticket();

create or replace function public.enqueue_email_on_support_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  req record;
begin
  if coalesce(new.is_internal, false) then
    return new;
  end if;

  select * into t from public.support_tickets where id = new.ticket_id;
  if t.id is null then return new; end if;
  -- Only notify requester when staff replies (author != requester)
  if new.author_user_id = t.requester_user_id then
    return new;
  end if;

  select id, email, display_name, full_name into req
  from public.profiles where id = t.requester_user_id;
  if req.id is null then return new; end if;

  perform public.enqueue_email_event(
    'support',
    'SUPPORT_TICKET_REPLY',
    req.id,
    req.email,
    null,
    'support_message',
    new.id,
    jsonb_build_object(
      'FIRST_NAME', coalesce(req.display_name, req.full_name, ''),
      'STATUS', coalesce(t.status, 'open'),
      'CTA_URL', 'https://nexomusicdistro.space/support',
      'CTA_LABEL', 'View reply'
    ),
    'SUPPORT_TICKET_REPLY:' || new.id::text,
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists support_messages_enqueue_email on public.support_messages;
create trigger support_messages_enqueue_email
  after insert on public.support_messages
  for each row execute function public.enqueue_email_on_support_reply();

-- Contact acknowledgement on submit_contact_message success path via trigger
create or replace function public.enqueue_email_on_contact_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_email_event(
    'contact',
    'CONTACT_ACKNOWLEDGEMENT',
    null,
    new.email,
    null,
    'contact_message',
    new.id,
    jsonb_build_object(
      'FIRST_NAME', coalesce(new.name, ''),
      'STATUS', coalesce(new.status, 'new'),
      'CTA_URL', 'https://nexomusicdistro.space',
      'CTA_LABEL', 'Visit Nexo'
    ),
    'CONTACT_ACKNOWLEDGEMENT:' || new.id::text,
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists contact_messages_enqueue_email on public.contact_messages;
create trigger contact_messages_enqueue_email
  after insert on public.contact_messages
  for each row execute function public.enqueue_email_on_contact_message();
