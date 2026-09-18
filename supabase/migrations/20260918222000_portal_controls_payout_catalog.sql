-- Nexo platform completion: admin-configured payout methods, portal feature controls,
-- encrypted provider webhook settings, and CMS-managed footer links.
-- Additive and idempotent.

-- ---------------------------------------------------------------------------
-- Admin-configured payout method catalog
-- ---------------------------------------------------------------------------
create table if not exists public.payout_method_options (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  method_type text not null
    check (method_type in ('bank_transfer','paypal','payoneer','mobile_money','other')),
  destination_label text not null default 'Account / destination',
  instructions text,
  requires_institution boolean not null default false,
  requires_country boolean not null default false,
  requires_currency boolean not null default false,
  requires_review boolean not null default true,
  allowed_countries text[],
  allowed_currencies text[],
  is_enabled boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_method_option_code_format
    check (code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  constraint payout_method_option_name_len
    check (char_length(btrim(display_name)) between 2 and 120),
  constraint payout_method_option_destination_len
    check (char_length(btrim(destination_label)) between 2 and 120)
);

alter table public.payout_method_options enable row level security;
revoke all on public.payout_method_options from anon, authenticated;
grant select on public.payout_method_options to authenticated;
grant all on public.payout_method_options to service_role;

drop policy if exists payout_method_options_select on public.payout_method_options;
create policy payout_method_options_select
  on public.payout_method_options
  for select to authenticated
  using (is_enabled or public.is_admin_portal_staff(auth.uid()));

create or replace function public.touch_payout_method_options_updated_at()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_payout_method_options_updated_at() from public, anon, authenticated;
grant execute on function public.touch_payout_method_options_updated_at() to service_role;

drop trigger if exists payout_method_options_touch on public.payout_method_options;
create trigger payout_method_options_touch
before update on public.payout_method_options
for each row execute function public.touch_payout_method_options_updated_at();

insert into public.payout_method_options
  (code,display_name,method_type,destination_label,instructions,requires_institution,requires_country,requires_currency,requires_review,sort_order)
values
  ('bank_transfer','Bank transfer','bank_transfer','Account number / IBAN','Enter the payout account details exactly as registered with your bank.',true,true,true,true,10),
  ('paypal','PayPal','paypal','PayPal email','Use the email address that receives PayPal payments.',false,false,true,false,20),
  ('payoneer','Payoneer','payoneer','Payoneer email / account','Use the email or receiving-account reference registered with Payoneer.',false,true,true,true,30),
  ('mobile_money','Mobile money','mobile_money','Mobile money number','Enter the mobile-money number including country code.',true,true,true,true,40)
on conflict (code) do nothing;

alter table public.payout_methods
  add column if not exists option_id uuid references public.payout_method_options(id) on delete set null;

create index if not exists payout_methods_option_idx
  on public.payout_methods(option_id,user_id);

update public.payout_methods pm
set option_id=o.id
from public.payout_method_options o
where pm.option_id is null
  and o.code=pm.method_type;

-- ---------------------------------------------------------------------------
-- Portal feature controls
-- ---------------------------------------------------------------------------
create table if not exists public.portal_feature_controls (
  href text primary key,
  label text not null,
  enabled_artist boolean not null default true,
  enabled_label boolean not null default true,
  admin_note text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint portal_feature_href_format check (href like '/%'),
  constraint portal_feature_label_len check (char_length(btrim(label)) between 1 and 120)
);

alter table public.portal_feature_controls enable row level security;
revoke all on public.portal_feature_controls from anon, authenticated;
grant select on public.portal_feature_controls to authenticated;
grant all on public.portal_feature_controls to service_role;

drop policy if exists portal_feature_controls_select on public.portal_feature_controls;
create policy portal_feature_controls_select
  on public.portal_feature_controls
  for select to authenticated
  using (true);

-- Optional service/report routes are enabled by default. Admin can disable per account type.
insert into public.portal_feature_controls(href,label)
values
  ('/sales','Sales'),
  ('/sales/releases','Sales · Releases'),
  ('/sales/tracks','Sales · Tracks'),
  ('/sales/stores','Sales · Stores / Services'),
  ('/sales/artists','Sales · Artists'),
  ('/sales/territories','Sales · Territories'),
  ('/sales/monthly','Sales · Monthly Overviews'),
  ('/sales/stream-rate','Sales · Stream Rate'),
  ('/reports','Reports'),
  ('/reports/sales','Reports · Sales'),
  ('/reports/catalog','Reports · Catalog'),
  ('/reports/payouts','Reports · Payouts'),
  ('/reports/release-links','Reports · Release Links'),
  ('/reports/additional','Reports · Additional Reports'),
  ('/reports/stream-data','Reports · Stream Data'),
  ('/reports/raw-data','Reports · Raw Data'),
  ('/analytics/insights','Insights'),
  ('/analytics/audience','Audience'),
  ('/analytics/usage-discovery','Usage Discovery'),
  ('/rights/greenlist','Greenlist'),
  ('/rights/blocklist','Blocklist'),
  ('/rights/profile-defender','Profile Defender'),
  ('/marketing/priority-pitch','Priority Pitch'),
  ('/marketing/chart-registration','Chart Registration'),
  ('/marketing/audio-recognition','Audio Recognition'),
  ('/marketing/tiktok-cml','TikTok CML'),
  ('/marketing/promotional-assets','Promotional Assets'),
  ('/marketing/fan-blast','Fan Blast'),
  ('/marketing/ai-mastering','AI Mastering'),
  ('/marketing/award-monitoring','Award Monitoring'),
  ('/rights/conflict-resolution','Conflict Resolution'),
  ('/account/preferences','Preferences'),
  ('/account/agreements','Signed agreements')
on conflict (href) do nothing;

-- ---------------------------------------------------------------------------
-- Private provider webhook signing settings
-- ---------------------------------------------------------------------------
create table if not exists public.distribution_webhook_settings (
  connection_key text primary key default 'primary',
  secret_ciphertext text,
  signature_header text not null default 'x-provider-signature',
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint distribution_webhook_signature_header_len
    check (char_length(signature_header) between 1 and 120)
);

alter table public.distribution_webhook_settings enable row level security;
revoke all on public.distribution_webhook_settings from public, anon, authenticated;
grant all on public.distribution_webhook_settings to service_role;

insert into public.distribution_webhook_settings(connection_key,enabled)
values ('primary',false)
on conflict (connection_key) do nothing;

-- ---------------------------------------------------------------------------
-- CMS-managed public footer links
-- ---------------------------------------------------------------------------
create table if not exists public.website_footer_links (
  id uuid primary key default gen_random_uuid(),
  section_key text not null
    check (section_key in ('services','company','get_started','legal')),
  label text not null,
  href text not null,
  sort_order integer not null default 100,
  enabled boolean not null default true,
  new_tab boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_footer_label_len check (char_length(btrim(label)) between 1 and 120),
  constraint website_footer_href_len check (char_length(btrim(href)) between 1 and 1000)
);

create index if not exists website_footer_links_section_idx
  on public.website_footer_links(section_key,sort_order,id);

alter table public.website_footer_links enable row level security;
grant select on public.website_footer_links to anon, authenticated;
grant all on public.website_footer_links to service_role;

drop policy if exists website_footer_public_select on public.website_footer_links;
create policy website_footer_public_select
  on public.website_footer_links
  for select to anon, authenticated
  using (enabled or public.is_admin_portal_staff(auth.uid()));

insert into public.website_footer_links(section_key,label,href,sort_order)
values
  ('services','Distribution','/distribution',10),
  ('services','Publishing','/publishing',20),
  ('services','Services','/services',30),
  ('services','For Artists','/artists',40),
  ('services','For Labels','/labels',50),
  ('company','Terms','/terms',10),
  ('company','Privacy','/privacy',20),
  ('company','Contact','/contact',30),
  ('company','Pricing','/pricing',40),
  ('get_started','Apply now','/register',10),
  ('get_started','Sign in','/login',20),
  ('get_started','Get Started','/get-started',30),
  ('get_started','Support','/faq',40),
  ('legal','Privacy Policy','/privacy',10),
  ('legal','Terms of Service','/terms',20),
  ('legal','Refund Policy','/refund-policy',30),
  ('legal','Cookie Policy','/cookies',40)
on conflict do nothing;

do $$
begin
  begin
    alter publication supabase_realtime add table public.payout_method_options;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.portal_feature_controls;
  exception when duplicate_object then null;
  end;
end $$;
