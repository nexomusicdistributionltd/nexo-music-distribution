-- Repair production audit enum drift.
-- write_audit_log references these values; without them even unrelated audited actions fail.
alter type public.audit_action add value if not exists 'email_compose_send';
alter type public.audit_action add value if not exists 'email_inbox_sync';
alter type public.audit_action add value if not exists 'email_automation_toggle';
