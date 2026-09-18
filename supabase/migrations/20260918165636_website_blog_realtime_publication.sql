-- Reconcile production realtime publication for published blog updates.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'blog_posts'
  ) then
    alter publication supabase_realtime add table public.blog_posts;
  end if;
end $$;
