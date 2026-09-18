create table if not exists public.distribution_provider_secrets (
  secret_key text primary key,
  secret_ciphertext text not null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.distribution_provider_secrets enable row level security;

revoke all on table public.distribution_provider_secrets from anon, authenticated;
grant select, insert, update, delete on table public.distribution_provider_secrets to service_role;

comment on table public.distribution_provider_secrets is
  'Server-only encrypted provider integration secrets. Never exposed to browser clients.';
