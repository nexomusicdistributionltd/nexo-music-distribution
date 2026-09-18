-- Realtime admin staff and role changes.
-- Enables Postgres Changes for the admin role-control surfaces.
-- Existing RLS policies restrict rows to the account owner or Nexo staff.

do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.user_roles;
  exception when duplicate_object then null;
  end;
end
$$;
