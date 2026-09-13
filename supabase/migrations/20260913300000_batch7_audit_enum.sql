-- NEXO Batch 7 — audit_action / notification_type / money & payout enum extensions
-- Must commit before use in subsequent migration in the same session.

alter type public.audit_action add value if not exists 'royalty_import';
alter type public.audit_action add value if not exists 'royalty_ledger_post';
alter type public.audit_action add value if not exists 'split_rule_change';
alter type public.audit_action add value if not exists 'statement_publish';
alter type public.audit_action add value if not exists 'payout_create';
alter type public.audit_action add value if not exists 'payout_payment_op';
alter type public.audit_action add value if not exists 'payout_webhook';
alter type public.audit_action add value if not exists 'publishing_work_update';
alter type public.audit_action add value if not exists 'publishing_share_change';
alter type public.audit_action add value if not exists 'fx_rate_unavailable';
alter type public.audit_action add value if not exists 'compliance_payout_hold';

alter type public.notification_type add value if not exists 'royalty_statement';
alter type public.notification_type add value if not exists 'payout_eligible';
alter type public.notification_type add value if not exists 'publishing_update';

-- Extend money entry kinds (additive)
alter type public.money_entry_kind add value if not exists 'deduction';
alter type public.money_entry_kind add value if not exists 'refund';

-- Extend payout status machine (additive; keep cancelled/on_hold)
alter type public.payout_status add value if not exists 'under_review';
alter type public.payout_status add value if not exists 'rejected';

-- Email event status already has pending/queued/skipped/failed/sent
