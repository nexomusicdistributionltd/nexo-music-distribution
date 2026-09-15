-- Nexo Music Distribution LTD — email_templates (admin-owned branded HTML)
-- Category: ops | newsletter | custom
-- Staff RLS only. Seeded from emails/templates/*.html by the app (ON CONFLICT DO NOTHING).
-- Never fabricate delivery; sending still goes through email_events + provider adapter.

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
set search_path = public
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
set search_path = public
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
set search_path = public
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

