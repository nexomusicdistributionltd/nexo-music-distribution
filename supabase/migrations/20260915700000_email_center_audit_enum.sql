-- Admin Communications + branded templates (on top of Zoho SMTP / email_outbound_events).
-- Must commit before write_audit_log allowlist uses these values.
alter type public.audit_action add value if not exists 'email_retry';
alter type public.audit_action add value if not exists 'email_template_write';
alter type public.audit_action add value if not exists 'email_manual_send';
alter type public.audit_action add value if not exists 'email_compose_send';
alter type public.audit_action add value if not exists 'email_inbox_sync';
alter type public.audit_action add value if not exists 'email_automation_toggle';
