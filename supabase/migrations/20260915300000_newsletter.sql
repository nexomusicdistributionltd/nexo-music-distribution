-- NEXO — Newsletter subscribers + campaigns (additive)
-- Public may INSERT subscribe only (via RPC). No public SELECT of emails.
-- Staff manage via is_staff. Realtime publication for staff dashboard.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.newsletter_subscriber_status as enum ('active', 'unsubscribed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.newsletter_campaign_status as enum (
    'draft', 'sending', 'sent', 'failed', 'unavailable', 'queued'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.newsletter_recipient_status as enum (
    'pending', 'queued', 'sent', 'failed', 'skipped'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status public.newsletter_subscriber_status not null default 'active',
  source text not null default 'footer',
  unsubscribe_token text not null default encode(gen_random_bytes(24), 'hex'),
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_subscribers_email_format check (
    email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

-- Unique active email (normalized lower(trim) at write time)
create unique index if not exists newsletter_subscribers_active_email_uidx
  on public.newsletter_subscribers (lower(email))
  where status = 'active';

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status, subscribed_at desc);

create unique index if not exists newsletter_subscribers_token_uidx
  on public.newsletter_subscribers (unsubscribe_token);

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body_html text not null,
  status public.newsletter_campaign_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  recipient_count int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  constraint newsletter_campaigns_subject_len check (char_length(subject) between 1 and 300),
  constraint newsletter_campaigns_body_len check (char_length(body_html) between 1 and 200000)
);

create index if not exists newsletter_campaigns_created_idx
  on public.newsletter_campaigns (created_at desc);

create table if not exists public.newsletter_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.newsletter_campaigns (id) on delete cascade,
  subscriber_id uuid not null references public.newsletter_subscribers (id) on delete cascade,
  email text not null,
  status public.newsletter_recipient_status not null default 'pending',
  outbound_event_id uuid references public.email_outbound_events (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, subscriber_id)
);

create index if not exists newsletter_campaign_recipients_campaign_idx
  on public.newsletter_campaign_recipients (campaign_id, status);

-- updated_at helper
create or replace function public.newsletter_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists newsletter_subscribers_updated_at on public.newsletter_subscribers;
create trigger newsletter_subscribers_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.newsletter_set_updated_at();

drop trigger if exists newsletter_campaign_recipients_updated_at on public.newsletter_campaign_recipients;
create trigger newsletter_campaign_recipients_updated_at
  before update on public.newsletter_campaign_recipients
  for each row execute function public.newsletter_set_updated_at();

-- ---------------------------------------------------------------------------
-- Subscribe RPC (anon/authenticated) — normalize email, handle duplicates
-- ---------------------------------------------------------------------------
create or replace function public.subscribe_newsletter(
  p_email text,
  p_source text default 'footer'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_source text := coalesce(nullif(trim(p_source), ''), 'footer');
  v_id uuid;
  v_status public.newsletter_subscriber_status;
begin
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;
  if char_length(v_email) > 320 then
    raise exception 'Invalid email' using errcode = '22023';
  end if;
  if char_length(v_source) > 80 then
    v_source := left(v_source, 80);
  end if;

  select id, status into v_id, v_status
  from public.newsletter_subscribers
  where lower(email) = v_email
  order by case when status = 'active' then 0 else 1 end, created_at desc
  limit 1;

  if v_id is not null and v_status = 'active' then
    return jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true);
  end if;

  if v_id is not null and v_status = 'unsubscribed' then
    update public.newsletter_subscribers
    set status = 'active',
        subscribed_at = now(),
        unsubscribed_at = null,
        source = v_source,
        unsubscribe_token = encode(gen_random_bytes(24), 'hex')
    where id = v_id
    returning id into v_id;
    return jsonb_build_object('ok', true, 'id', v_id, 'reactivated', true);
  end if;

  insert into public.newsletter_subscribers (email, status, source)
  values (v_email, 'active', v_source)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
exception
  when unique_violation then
    select id into v_id from public.newsletter_subscribers
    where lower(email) = v_email and status = 'active' limit 1;
    return jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true);
end;
$$;

revoke all on function public.subscribe_newsletter(text, text) from public;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Unsubscribe by token
-- ---------------------------------------------------------------------------
create or replace function public.unsubscribe_newsletter(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := trim(p_token);
  v_id uuid;
begin
  if v_token is null or char_length(v_token) < 16 then
    raise exception 'Invalid token' using errcode = '22023';
  end if;

  update public.newsletter_subscribers
  set status = 'unsubscribed',
      unsubscribed_at = coalesce(unsubscribed_at, now())
  where unsubscribe_token = v_token
    and status = 'active'
  returning id into v_id;

  if v_id is null then
    -- Already unsubscribed or unknown — idempotent success if token exists
    select id into v_id from public.newsletter_subscribers where unsubscribe_token = v_token;
    if v_id is null then
      raise exception 'Invalid token' using errcode = '22023';
    end if;
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.unsubscribe_newsletter(text) from public;
grant execute on function public.unsubscribe_newsletter(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_campaign_recipients enable row level security;

drop policy if exists "newsletter_subscribers_staff_all" on public.newsletter_subscribers;
create policy "newsletter_subscribers_staff_all" on public.newsletter_subscribers
  for all
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- No public SELECT of emails. Inserts go through SECURITY DEFINER RPC.

drop policy if exists "newsletter_campaigns_staff_all" on public.newsletter_campaigns;
create policy "newsletter_campaigns_staff_all" on public.newsletter_campaigns
  for all
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists "newsletter_recipients_staff_all" on public.newsletter_campaign_recipients;
create policy "newsletter_recipients_staff_all" on public.newsletter_campaign_recipients
  for all
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- Realtime for staff dashboard
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.newsletter_subscribers;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

comment on table public.newsletter_subscribers is 'Public newsletter list; emails not readable by anon.';
comment on table public.newsletter_campaigns is 'Staff newsletter campaigns; send via server-only provider path.';
comment on function public.subscribe_newsletter(text, text) is 'Public subscribe; normalizes email; graceful duplicates.';
