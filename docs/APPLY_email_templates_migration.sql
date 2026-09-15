-- Admin-owned branded email templates (ops + newsletter + custom).
-- RLS: staff only. Seed HTML is applied from repo files by the app (never overwrite edits).
-- Enum values for template/send audits. email_retry already added in 20260913180000.

alter type public.audit_action add value if not exists 'email_template_write';
alter type public.audit_action add value if not exists 'email_manual_send';
-- Nexo Music Distribution LTD — email_templates (admin-owned branded HTML)
-- Category: ops | newsletter | custom
-- Staff RLS only. Seeded from emails/templates/*.html by the app (ON CONFLICT DO NOTHING).
-- Never fabricate delivery; sending still goes through email_outbound_events + provider adapter.

create table if not exists public.email_templates (
  key text primary key,
  name text not null,
  category text not null
    check (category in ('ops', 'newsletter', 'custom')),
  subject text not null,
  html_body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users (id) on delete set null,
  constraint email_templates_key_format check (key ~ '^[A-Z][A-Z0-9_]{1,62}$'),
  constraint email_templates_not_auth check (key !~ '^AUTH_')
);

create index if not exists email_templates_category_idx on public.email_templates (category);
create index if not exists email_templates_updated_at_idx on public.email_templates (updated_at desc);

comment on table public.email_templates is
  'Admin-owned branded email HTML. Ops/newsletter seeded from repo files; custom clones the dark Nexo shell.';

create or replace function public.touch_email_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists email_templates_touch_updated_at on public.email_templates;
create trigger email_templates_touch_updated_at
  before update on public.email_templates
  for each row execute function public.touch_email_templates_updated_at();

-- Protect seeded ops/newsletter keys from delete; custom may be removed.
create or replace function public.protect_seeded_email_templates()
returns trigger
language plpgsql
as $$
begin
  if old.category in ('ops', 'newsletter') then
    raise exception 'Cannot delete seeded ops or newsletter templates' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists email_templates_protect_seeded on public.email_templates;
create trigger email_templates_protect_seeded
  before delete on public.email_templates
  for each row execute function public.protect_seeded_email_templates();

-- Disallow changing key or category away from seeded rows
create or replace function public.protect_email_template_identity()
returns trigger
language plpgsql
as $$
begin
  if old.key is distinct from new.key then
    raise exception 'email_templates.key is immutable' using errcode = 'P0001';
  end if;
  if old.category in ('ops', 'newsletter') and new.category is distinct from old.category then
    raise exception 'Cannot change category of seeded templates' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists email_templates_protect_identity on public.email_templates;
create trigger email_templates_protect_identity
  before update on public.email_templates
  for each row execute function public.protect_email_template_identity();

alter table public.email_templates enable row level security;

drop policy if exists "email_templates_staff_select" on public.email_templates;
create policy "email_templates_staff_select" on public.email_templates
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support')
  );

drop policy if exists "email_templates_staff_insert" on public.email_templates;
create policy "email_templates_staff_insert" on public.email_templates
  for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support')
  );

drop policy if exists "email_templates_staff_update" on public.email_templates;
create policy "email_templates_staff_update" on public.email_templates
  for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support')
  );

drop policy if exists "email_templates_staff_delete" on public.email_templates;
create policy "email_templates_staff_delete" on public.email_templates
  for delete to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
    or public.has_role(auth.uid(), 'support')
  );

revoke all on table public.email_templates from public;
grant select, insert, update, delete on table public.email_templates to authenticated;
grant all on table public.email_templates to service_role;

-- Add email template/send audits to the staff allowlist without dropping later-batch actions.
-- This recreates write_audit_log from the Batch 5 base on this branch, plus email_retry /
-- email_template_write / email_manual_send. Environments that already have later audit
-- actions must merge those into the staff list when applying (see remote apply notes).

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
    'release_takedown_request', 'asset_upload'
  ) then
    null;
  elsif p_action in (
    'qc_review', 'qc_claim', 'qc_bulk', 'ticket_update', 'compliance_update',
    'admin_search', 'contact_message', 'payout_status_change', 'royalty_adjustment',
    'account_suspend', 'account_restore', 'account_restrict',
    'email_retry', 'email_template_write', 'email_manual_send'
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
    - 'internal_note';

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (uid, p_action, p_entity_type, coalesce(p_entity_id, uid), safe_meta)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.write_audit_log(public.audit_action, text, uuid, jsonb) from public;
grant execute on function public.write_audit_log(public.audit_action, text, uuid, jsonb) to authenticated;
