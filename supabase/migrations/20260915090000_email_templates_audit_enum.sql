-- Admin-owned branded email templates (ops + newsletter + custom).
-- RLS: staff only. Seed HTML is applied from repo files by the app (never overwrite edits).
-- Enum values for template/send audits. email_retry already added in 20260913180000.

alter type public.audit_action add value if not exists 'email_template_write';
alter type public.audit_action add value if not exists 'email_manual_send';
