-- Batch 6 — enum extensions (must commit before use in later migrations)
alter type public.audit_action add value if not exists 'distribution_queue';
alter type public.audit_action add value if not exists 'distribution_submit';
alter type public.audit_action add value if not exists 'distribution_sync';
alter type public.audit_action add value if not exists 'distribution_webhook';
alter type public.audit_action add value if not exists 'distribution_takedown';
alter type public.audit_action add value if not exists 'distribution_reinstate';
alter type public.audit_action add value if not exists 'distribution_retry';
alter type public.audit_action add value if not exists 'catalog_migration';
alter type public.audit_action add value if not exists 'catalog_mapping';

alter type public.release_status add value if not exists 'failed';

alter type public.notification_type add value if not exists 'distribution_update';
alter type public.notification_type add value if not exists 'distribution_failed';
alter type public.notification_type add value if not exists 'catalog_migration_update';

-- email_event_status already has queued/failed/sent/skipped — add pending alias for queue UX
alter type public.email_event_status add value if not exists 'pending';
