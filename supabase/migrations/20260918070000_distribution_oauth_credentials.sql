-- Private OAuth credential storage for the server-side Distribution Engine.
-- Ciphertext only. No authenticated/browser role receives SELECT or write grants.
create table if not exists public.distribution_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  connection_key text not null unique default 'primary',
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_type text,
  scope text,
  expires_at timestamptz,
  provider_account_ref text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.distribution_provider_credentials enable row level security;

revoke all on table public.distribution_provider_credentials from anon, authenticated;
grant select, insert, update, delete on table public.distribution_provider_credentials to service_role;

drop trigger if exists distribution_provider_credentials_set_updated_at
  on public.distribution_provider_credentials;
create trigger distribution_provider_credentials_set_updated_at
  before update on public.distribution_provider_credentials
  for each row execute function public.set_updated_at();

comment on table public.distribution_provider_credentials is
  'Server-only encrypted OAuth credentials for the private Distribution Engine.';
