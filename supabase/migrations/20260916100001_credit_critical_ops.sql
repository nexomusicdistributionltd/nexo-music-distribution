-- NEXO credit-critical ops: playlist pitching, DSP profile links, role lockout, contact reply.
-- Additive only. RLS enabled on new tables.

-- ---------------------------------------------------------------------------
-- Contact reply metadata
-- ---------------------------------------------------------------------------
alter table public.contact_messages
  add column if not exists replied_at timestamptz,
  add column if not exists reply_outbound_event_id uuid;

-- ---------------------------------------------------------------------------
-- Artist DSP profile links (metadata / targeting — not commercial DSP credentials)
-- ---------------------------------------------------------------------------
create table if not exists public.artist_dsp_links (
  id uuid primary key default gen_random_uuid(),
  artist_profile_id uuid not null references public.artist_profiles (id) on delete cascade,
  dsp_key text not null,
  url text,
  enabled boolean not null default false,
  preview_name text,
  preview_image_url text,
  preview_canonical_url text,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_profile_id, dsp_key),
  constraint artist_dsp_links_enabled_needs_url check (
    enabled = false or (url is not null and length(btrim(url)) > 0)
  )
);

create index if not exists artist_dsp_links_artist_idx
  on public.artist_dsp_links (artist_profile_id);

drop trigger if exists artist_dsp_links_set_updated_at on public.artist_dsp_links;
create trigger artist_dsp_links_set_updated_at
  before update on public.artist_dsp_links
  for each row execute function public.set_updated_at();

alter table public.artist_dsp_links enable row level security;

drop policy if exists "artist_dsp_links_select" on public.artist_dsp_links;
create policy "artist_dsp_links_select" on public.artist_dsp_links
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.artist_profiles ap
      where ap.id = artist_profile_id and ap.user_id = auth.uid()
    )
    or public.label_manages_artist(artist_profile_id)
  );

drop policy if exists "artist_dsp_links_write" on public.artist_dsp_links;
create policy "artist_dsp_links_insert" on public.artist_dsp_links
  for insert to authenticated
  with check (
    exists (
      select 1 from public.artist_profiles ap
      where ap.id = artist_profile_id and ap.user_id = auth.uid()
    )
    or public.label_manages_artist(artist_profile_id)
  );

create policy "artist_dsp_links_update" on public.artist_dsp_links
  for update to authenticated
  using (
    exists (
      select 1 from public.artist_profiles ap
      where ap.id = artist_profile_id and ap.user_id = auth.uid()
    )
    or public.label_manages_artist(artist_profile_id)
  )
  with check (
    exists (
      select 1 from public.artist_profiles ap
      where ap.id = artist_profile_id and ap.user_id = auth.uid()
    )
    or public.label_manages_artist(artist_profile_id)
  );

create policy "artist_dsp_links_delete" on public.artist_dsp_links
  for delete to authenticated
  using (
    exists (
      select 1 from public.artist_profiles ap
      where ap.id = artist_profile_id and ap.user_id = auth.uid()
    )
    or public.label_manages_artist(artist_profile_id)
  );

-- Snapshot of enabled DSP profile links at release submit / targeting time
create table if not exists public.release_dsp_profile_targets (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases (id) on delete cascade,
  dsp_key text not null,
  url text not null,
  enabled boolean not null default true,
  artist_dsp_link_id uuid references public.artist_dsp_links (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (release_id, dsp_key)
);

create index if not exists release_dsp_profile_targets_release_idx
  on public.release_dsp_profile_targets (release_id);

alter table public.release_dsp_profile_targets enable row level security;

create policy "release_dsp_targets_select" on public.release_dsp_profile_targets
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.releases r
      where r.id = release_id and r.owner_user_id = auth.uid()
    )
  );

create policy "release_dsp_targets_write" on public.release_dsp_profile_targets
  for insert to authenticated
  with check (
    exists (
      select 1 from public.releases r
      where r.id = release_id and r.owner_user_id = auth.uid()
    )
  );

create policy "release_dsp_targets_update" on public.release_dsp_profile_targets
  for update to authenticated
  using (
    exists (
      select 1 from public.releases r
      where r.id = release_id and r.owner_user_id = auth.uid()
    )
    or public.is_staff(auth.uid())
  )
  with check (
    exists (
      select 1 from public.releases r
      where r.id = release_id and r.owner_user_id = auth.uid()
    )
    or public.is_staff(auth.uid())
  );

create policy "release_dsp_targets_delete" on public.release_dsp_profile_targets
  for delete to authenticated
  using (
    exists (
      select 1 from public.releases r
      where r.id = release_id and r.owner_user_id = auth.uid()
    )
    or public.is_staff(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Playlist pitching
-- ---------------------------------------------------------------------------
create table if not exists public.playlist_pitch_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  artist_profile_id uuid references public.artist_profiles (id) on delete set null,
  release_id uuid references public.releases (id) on delete set null,
  track_id uuid references public.release_tracks (id) on delete set null,
  playlist_name text not null,
  playlist_url text,
  pitch_note text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'reviewing', 'accepted', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists playlist_pitch_owner_idx
  on public.playlist_pitch_requests (owner_user_id, created_at desc);
create index if not exists playlist_pitch_status_idx
  on public.playlist_pitch_requests (status, created_at desc);

drop trigger if exists playlist_pitch_set_updated_at on public.playlist_pitch_requests;
create trigger playlist_pitch_set_updated_at
  before update on public.playlist_pitch_requests
  for each row execute function public.set_updated_at();

alter table public.playlist_pitch_requests enable row level security;

create policy "playlist_pitch_select" on public.playlist_pitch_requests
  for select to authenticated
  using (owner_user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "playlist_pitch_insert" on public.playlist_pitch_requests
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and status = 'draft'
    and reviewed_by is null
    and admin_note is null
  );

create policy "playlist_pitch_owner_update" on public.playlist_pitch_requests
  for update to authenticated
  using (owner_user_id = auth.uid() and status in ('draft', 'rejected'))
  with check (
    owner_user_id = auth.uid()
    and status in ('draft', 'submitted')
    and reviewed_by is null
  );

create policy "playlist_pitch_staff_update" on public.playlist_pitch_requests
  for update to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create policy "playlist_pitch_owner_delete" on public.playlist_pitch_requests
  for delete to authenticated
  using (owner_user_id = auth.uid() and status = 'draft');

do $$
begin
  begin
    alter publication supabase_realtime add table public.playlist_pitch_requests;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.artist_dsp_links;
  exception
    when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Last super_admin lockout
-- ---------------------------------------------------------------------------
create or replace function public.super_admin_set_roles(
  p_target uuid,
  p_roles public.app_role[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.app_role;
  had_super boolean;
  keeps_super boolean;
  super_count int;
  had_artist boolean;
  keeps_artist boolean;
  had_label boolean;
  keeps_label boolean;
  roster_count int;
  release_count int;
begin
  if actor is null or not public.has_role(actor, 'super_admin') then
    raise exception 'super_admin required' using errcode = '42501';
  end if;

  if p_roles is null then
    p_roles := array[]::public.app_role[];
  end if;

  if 'artist' = any (p_roles) and 'label' = any (p_roles) then
    raise exception 'Artist and label cannot be combined on one account' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.user_roles where user_id = p_target and role = 'super_admin'
  ) into had_super;
  keeps_super := 'super_admin' = any (p_roles);

  if p_target = actor and had_super and not keeps_super then
    raise exception 'Cannot remove own super_admin role' using errcode = 'P0001';
  end if;

  if had_super and not keeps_super then
    select count(*) into super_count from public.user_roles where role = 'super_admin';
    if super_count <= 1 then
      raise exception 'Cannot remove the last super_admin' using errcode = 'P0001';
    end if;
  end if;

  select exists (
    select 1 from public.user_roles where user_id = p_target and role = 'artist'
  ) into had_artist;
  select exists (
    select 1 from public.user_roles where user_id = p_target and role = 'label'
  ) into had_label;
  keeps_artist := 'artist' = any (p_roles);
  keeps_label := 'label' = any (p_roles);

  if had_label and not keeps_label then
    select count(*) into roster_count
    from public.label_roster_artists lra
    join public.label_profiles lp on lp.id = lra.label_profile_id
    where lp.user_id = p_target;
    if roster_count > 0 then
      raise exception 'Cannot revoke label while roster artists exist' using errcode = 'P0001';
    end if;
  end if;

  if had_artist and not keeps_artist then
    select count(*) into release_count
    from public.releases
    where owner_user_id = p_target;
    if release_count > 0 then
      raise exception 'Cannot revoke artist while this account owns catalog releases' using errcode = 'P0001';
    end if;
  end if;

  delete from public.user_roles where user_id = p_target;
  foreach r in array p_roles loop
    insert into public.user_roles (user_id, role) values (p_target, r)
    on conflict do nothing;
  end loop;

  update public.profiles
  set account_type = coalesce(p_roles[1]::text, account_type),
      updated_at = now()
  where id = p_target;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'role_change', 'profile', p_target, jsonb_build_object('roles', to_jsonb(p_roles)));
end;
$$;

revoke all on function public.super_admin_set_roles(uuid, public.app_role[]) from public;
grant execute on function public.super_admin_set_roles(uuid, public.app_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit allowlist (extends prior Communications + DDEX + billing)
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
    'otp_verified', 'otp_expired',
    'playlist_pitch_create', 'playlist_pitch_submit', 'dsp_profile_update'
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
    'ddex_message_record', 'ddex_generate', 'ddex_validate', 'ddex_download',
    'ddex_package', 'ddex_queue', 'ddex_deliver', 'ddex_retry', 'ddex_ack',
    'ddex_update', 'ddex_takedown',
    'email_retry', 'email_template_write', 'email_manual_send',
    'email_compose_send', 'email_inbox_sync', 'email_automation_toggle',
    'billing_checkout_start', 'billing_webhook', 'billing_portal_session',
    'billing_subscription_sync',
    'playlist_pitch_review', 'contact_reply'
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

grant select, insert, update, delete on table public.artist_dsp_links to authenticated;
grant select, insert, update, delete on table public.release_dsp_profile_targets to authenticated;
grant select, insert, update, delete on table public.playlist_pitch_requests to authenticated;
