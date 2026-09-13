-- NEXO Batch 4 — audit_action enum extensions (must commit before use)
alter type public.audit_action add value if not exists 'release_create';
alter type public.audit_action add value if not exists 'release_update';
alter type public.audit_action add value if not exists 'release_submit';
alter type public.audit_action add value if not exists 'release_status_change';
alter type public.audit_action add value if not exists 'release_duplicate';
alter type public.audit_action add value if not exists 'release_takedown_request';
alter type public.audit_action add value if not exists 'asset_upload';
