-- Public contact inbox must appear in staff Realtime (Admin contact page).
do $$
begin
  alter publication supabase_realtime add table public.contact_messages;
exception
  when duplicate_object then null;
end $$;
