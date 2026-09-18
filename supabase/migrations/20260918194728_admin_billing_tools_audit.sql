-- Audit actions for explicit administrative billing entitlement changes.
alter type public.audit_action add value if not exists 'billing_plan_override';
alter type public.audit_action add value if not exists 'billing_plan_override_cleared';
