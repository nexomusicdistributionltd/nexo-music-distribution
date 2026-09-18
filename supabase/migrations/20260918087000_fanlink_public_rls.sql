-- Restrict public fanlink visibility to published/live rows.
drop policy if exists "fanlinks_public_read" on public.fanlinks;
create policy "fanlinks_public_read" on public.fanlinks for select using (
 is_published = true or owner_user_id = auth.uid() or public.is_staff(auth.uid())
);
