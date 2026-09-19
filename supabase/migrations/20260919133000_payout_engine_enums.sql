-- Global payout engine enum/audit extensions.
-- Kept separate so later migrations can safely use newly-added enum values.

alter type public.payout_status add value if not exists 'draft';
alter type public.payout_status add value if not exists 'returned';

alter type public.audit_action add value if not exists 'payout_method_create';
alter type public.audit_action add value if not exists 'payout_method_update';
alter type public.audit_action add value if not exists 'payout_method_disable';
alter type public.audit_action add value if not exists 'payout_default_method_change';
alter type public.audit_action add value if not exists 'payout_approve';
alter type public.audit_action add value if not exists 'payout_reject';
alter type public.audit_action add value if not exists 'payout_info_request';
alter type public.audit_action add value if not exists 'payout_payment_record';
alter type public.audit_action add value if not exists 'payout_paid';
alter type public.audit_action add value if not exists 'payout_failed';
alter type public.audit_action add value if not exists 'payout_returned';
alter type public.audit_action add value if not exists 'payout_retry';
alter type public.audit_action add value if not exists 'payout_security_override';
alter type public.audit_action add value if not exists 'payout_provider_change';
alter type public.audit_action add value if not exists 'payout_fee_change';
alter type public.audit_action add value if not exists 'payout_route_change';
alter type public.audit_action add value if not exists 'payout_currency_change';
alter type public.audit_action add value if not exists 'payout_country_change';
