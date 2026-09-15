-- Portal / admin dashboards subscribe to webhook-synced billing_subscriptions.
-- RLS already restricts SELECT to the owner or admin portal staff.
do $$
begin
  alter publication supabase_realtime add table public.billing_subscriptions;
exception
  when duplicate_object then null;
end $$;
