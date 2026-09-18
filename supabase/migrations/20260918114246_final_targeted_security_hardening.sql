-- Final targeted security hardening.
-- Remove unnecessary anonymous execution from the new authenticated-only RPCs
-- and pin search_path on the four advisor-flagged invoker/trigger helpers.

revoke execute on function public.post_royalty_import_batch(uuid) from anon;
revoke execute on function public.create_label_roster_artist_with_dsp(text,text,text,text[],text,text,jsonb) from anon;

alter function public.set_updated_at() set search_path = public;
alter function public.sync_artist_profile_fields() set search_path = public;
alter function public.protect_catalog_migration_hard_delete() set search_path = public;
alter function public.is_website_release_eligible(public.releases) set search_path = public;
