-- NEXO mandatory login email OTP (second step) + logout invalidation
-- Server-only hashes. RLS deny-all for anon/authenticated. No self-verify.

-- ---------------------------------------------------------------------------
-- Challenges (HASH only — never plaintext OTP)
-- ---------------------------------------------------------------------------
create table if not exists public.login_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id text not null,
  purpose text not null default 'login_email_otp',
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  attempt_count int not null default 0,
  consumed_at timestamptz,
  superseded_at timestamptz,
  invalidated_at timestamptz,
  constraint login_otp_challenges_purpose_chk check (purpose = 'login_email_otp'),
  constraint login_otp_challenges_hash_len check (char_length(code_hash) = 64),
  constraint login_otp_challenges_session_len check (char_length(session_id) between 8 and 128),
  constraint login_otp_challenges_attempts_chk check (attempt_count >= 0 and attempt_count <= 100)
);

create index if not exists login_otp_challenges_user_session_idx
  on public.login_otp_challenges (user_id, session_id, created_at desc);

create index if not exists login_otp_challenges_active_idx
  on public.login_otp_challenges (user_id, session_id)
  where consumed_at is null and superseded_at is null and invalidated_at is null;

comment on table public.login_otp_challenges is
  'Nexo login email OTP challenges. Stores HMAC-SHA256 hash only. Server/service-role only.';

-- ---------------------------------------------------------------------------
-- Per-session second-step completion (not a global account flag)
-- ---------------------------------------------------------------------------
create table if not exists public.login_otp_verified_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id text not null,
  challenge_id uuid references public.login_otp_challenges (id) on delete set null,
  verified_at timestamptz not null default now(),
  unique (user_id, session_id),
  constraint login_otp_verified_session_len check (char_length(session_id) between 8 and 128)
);

create index if not exists login_otp_verified_sessions_session_idx
  on public.login_otp_verified_sessions (session_id);

comment on table public.login_otp_verified_sessions is
  'Completed Nexo email OTP for a specific Supabase Auth session. Logout removes the row.';

-- ---------------------------------------------------------------------------
-- RLS: deny all client access (hashes must not be readable; users cannot self-verify)
-- ---------------------------------------------------------------------------
alter table public.login_otp_challenges enable row level security;
alter table public.login_otp_challenges force row level security;
alter table public.login_otp_verified_sessions enable row level security;
alter table public.login_otp_verified_sessions force row level security;

revoke all on public.login_otp_challenges from public, anon, authenticated;
revoke all on public.login_otp_verified_sessions from public, anon, authenticated;

-- service_role bypasses RLS; keep explicit grants for jobs/API
grant all on public.login_otp_challenges to service_role;
grant all on public.login_otp_verified_sessions to service_role;

-- ---------------------------------------------------------------------------
-- Session status (boolean only — no hashes)
-- ---------------------------------------------------------------------------
create or replace function public.nexo_login_otp_verified()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sid text := coalesce(auth.jwt() ->> 'session_id', '');
begin
  if uid is null or length(sid) < 8 then
    return false;
  end if;
  return exists (
    select 1
    from public.login_otp_verified_sessions v
    where v.user_id = uid
      and v.session_id = sid
  );
end;
$$;

revoke all on function public.nexo_login_otp_verified() from public, anon;
grant execute on function public.nexo_login_otp_verified() to authenticated;

comment on function public.nexo_login_otp_verified() is
  'True when THIS Supabase session completed Nexo email OTP. No admin bypass.';

-- ---------------------------------------------------------------------------
-- Logout: drop verified second-step + unfinished challenges for this user (all sessions)
-- ---------------------------------------------------------------------------
create or replace function public.nexo_login_otp_invalidate_current()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  update public.login_otp_challenges
  set
    invalidated_at = coalesce(invalidated_at, now()),
    superseded_at = coalesce(superseded_at, now())
  where user_id = uid
    and consumed_at is null
    and invalidated_at is null;

  delete from public.login_otp_verified_sessions
  where user_id = uid;
end;
$$;

revoke all on function public.nexo_login_otp_invalidate_current() from public, anon;
grant execute on function public.nexo_login_otp_invalidate_current() to authenticated;

-- ---------------------------------------------------------------------------
-- Audit allowlist: login OTP events (any authenticated user, own actor)
-- Keep prior staff/admin branches. Strip OTP secrets from metadata.
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_action public.audit_action,
  p_entity_type text default 'user',
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  safe_meta jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required to write audit logs' using errcode = '42501';
  end if;

  if p_action in (
    'login', 'logout', 'profile_update', 'password_reset_request',
    'signup', 'email_verified', 'release_submit', 'release_update',
    'release_status_change', 'release_create', 'release_duplicate',
    'release_takedown_request', 'asset_upload',
    'login_password_success', 'otp_sent', 'otp_resent', 'otp_failed',
    'otp_verified', 'otp_expired'
  ) then
    null;
  elsif p_action in (
    'qc_review', 'qc_claim', 'qc_bulk', 'ticket_update', 'compliance_update',
    'admin_search', 'contact_message', 'payout_status_change', 'royalty_adjustment',
    'account_suspend', 'account_restore', 'account_restrict',
    'distribution_queue', 'distribution_submit', 'distribution_sync',
    'distribution_webhook', 'distribution_takedown', 'distribution_reinstate',
    'distribution_retry', 'catalog_migration', 'catalog_mapping',
    'royalty_import', 'royalty_ledger_post', 'split_rule_change', 'statement_publish',
    'payout_create', 'payout_payment_op', 'payout_webhook', 'publishing_work_update',
    'publishing_share_change', 'fx_rate_unavailable', 'compliance_payout_hold',
    'website_publish', 'website_unpublish', 'cms_page_upsert', 'blog_post_upsert',
    'partner_upsert', 'catalog_migration_import', 'catalog_migration_move_in',
    'roster_artist_create', 'roster_artist_update', 'release_deal_upsert',
    'ddex_message_record', 'ddex_generate', 'ddex_validate', 'ddex_download'
  ) then
    if not public.is_admin_portal_staff(uid) then
      raise exception 'Audit action requires staff privileges' using errcode = '42501';
    end if;
  elsif p_action in ('status_change', 'settings_update', 'report_export') then
    if not (public.has_role(uid, 'admin') or public.has_role(uid, 'super_admin')) then
      raise exception 'Audit action requires admin privileges' using errcode = '42501';
    end if;
  elsif p_action = 'role_change' then
    if not public.has_role(uid, 'super_admin') then
      raise exception 'role_change audit requires super_admin' using errcode = '42501';
    end if;
  else
    raise exception 'Audit action not allowed' using errcode = '42501';
  end if;

  safe_meta := coalesce(p_metadata, '{}'::jsonb)
    - 'password' - 'token' - 'access_token' - 'refresh_token' - 'service_role_key'
    - 'internal_note' - 'otp' - 'otp_code' - 'code' - 'code_hash' - 'plaintext_otp' - 'hash';

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, p_action, p_entity_type, coalesce(p_entity_id, uid), safe_meta)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.write_audit_log(public.audit_action, text, uuid, jsonb) from public;
grant execute on function public.write_audit_log(public.audit_action, text, uuid, jsonb) to authenticated;

-- Tighten audit_logs secret check (additive)
alter table public.audit_logs drop constraint if exists audit_logs_no_secrets;
alter table public.audit_logs add constraint audit_logs_no_secrets check (
  not (metadata ? 'password')
  and not (metadata ? 'token')
  and not (metadata ? 'access_token')
  and not (metadata ? 'refresh_token')
  and not (metadata ? 'service_role_key')
  and not (metadata ? 'otp')
  and not (metadata ? 'otp_code')
  and not (metadata ? 'code_hash')
  and not (metadata ? 'plaintext_otp')
);
