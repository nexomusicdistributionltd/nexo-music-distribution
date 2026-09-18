-- Reconcile secure runtime webhook secret storage and realtime admin visibility.
-- The secret is encrypted by the application with DISTRIBUTION_TOKEN_ENCRYPTION_KEY.
-- No webhook secret is exposed to anon/authenticated database roles.

create table if not exists public.distribution_provider_secrets (
  secret_key text primary key,
  secret_ciphertext text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.distribution_provider_secrets enable row level security;

revoke all on table public.distribution_provider_secrets from public, anon, authenticated;
grant select, insert, update, delete on table public.distribution_provider_secrets to service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.provider_webhook_events;
  exception when duplicate_object then null;
  end;
end $$;
