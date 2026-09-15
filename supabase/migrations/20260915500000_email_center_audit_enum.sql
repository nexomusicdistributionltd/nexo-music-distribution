-- Admin Email Center + branded templates (on top of Zoho SMTP / email_outbound_events).
alter type public.audit_action add value if not exists 'email_retry';
alter type public.audit_action add value if not exists 'email_template_write';
alter type public.audit_action add value if not exists 'email_manual_send';
alter type public.audit_action add value if not exists 'email_compose_send';
alter type public.audit_action add value if not exists 'email_inbox_sync';
