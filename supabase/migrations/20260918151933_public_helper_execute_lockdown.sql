
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_admin_portal_staff(uuid) from public, anon;
revoke all on function public.is_staff(uuid) from public, anon;
revoke all on function public.label_manages_artist(uuid) from public, anon;
revoke all on function public.label_owns_profile(uuid) from public, anon;
revoke all on function public.owns_release(uuid) from public, anon;
revoke all on function public.release_is_editable(uuid) from public, anon;
revoke all on function public.storage_object_release_mutable(text) from public, anon;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_admin_portal_staff(uuid) to authenticated, service_role;
grant execute on function public.is_staff(uuid) to authenticated, service_role;
grant execute on function public.label_manages_artist(uuid) to authenticated, service_role;
grant execute on function public.label_owns_profile(uuid) to authenticated, service_role;
grant execute on function public.owns_release(uuid) to authenticated, service_role;
grant execute on function public.release_is_editable(uuid) to authenticated, service_role;
grant execute on function public.storage_object_release_mutable(text) to authenticated, service_role;
