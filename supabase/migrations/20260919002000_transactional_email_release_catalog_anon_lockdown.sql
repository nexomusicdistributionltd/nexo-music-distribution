-- Remove an inherited anonymous EXECUTE grant from the release email hook.
-- The hook is only for authenticated application flows and trusted service jobs.

revoke execute on function public.enqueue_release_catalog_email(
  uuid, public.release_status, public.release_status, uuid, text, jsonb
) from anon;

revoke execute on function public.enqueue_release_catalog_email(
  uuid, public.release_status, public.release_status, uuid, text, jsonb
) from public;

grant execute on function public.enqueue_release_catalog_email(
  uuid, public.release_status, public.release_status, uuid, text, jsonb
) to authenticated, service_role;
