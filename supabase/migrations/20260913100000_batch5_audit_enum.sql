-- NEXO Batch 5 — audit_action / notification_type enum extensions (commit before use)
alter type public.audit_action add value if not exists 'qc_review';
alter type public.audit_action add value if not exists 'qc_claim';
alter type public.audit_action add value if not exists 'qc_bulk';
alter type public.audit_action add value if not exists 'account_suspend';
alter type public.audit_action add value if not exists 'account_restore';
alter type public.audit_action add value if not exists 'account_restrict';
alter type public.audit_action add value if not exists 'payout_status_change';
alter type public.audit_action add value if not exists 'royalty_adjustment';
alter type public.audit_action add value if not exists 'compliance_update';
alter type public.audit_action add value if not exists 'ticket_update';
alter type public.audit_action add value if not exists 'contact_message';
alter type public.audit_action add value if not exists 'settings_update';
alter type public.audit_action add value if not exists 'report_export';
alter type public.audit_action add value if not exists 'admin_search';

alter type public.notification_type add value if not exists 'ticket_reply';
alter type public.notification_type add value if not exists 'account_status';
alter type public.notification_type add value if not exists 'compliance_update';
alter type public.notification_type add value if not exists 'payout_update';
