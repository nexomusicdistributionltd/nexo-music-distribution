-- Paddle Billing (Sandbox) — audit_action extensions. Must commit before use.

alter type public.audit_action add value if not exists 'billing_checkout_start';
alter type public.audit_action add value if not exists 'billing_webhook';
alter type public.audit_action add value if not exists 'billing_portal_session';
alter type public.audit_action add value if not exists 'billing_subscription_sync';
