-- Stardust Distro internal DDEX delivery layer — audit_action values (must commit before use).
-- Additive only. Does not invent commercial DSP connections.

alter type public.audit_action add value if not exists 'ddex_package';
alter type public.audit_action add value if not exists 'ddex_queue';
alter type public.audit_action add value if not exists 'ddex_deliver';
alter type public.audit_action add value if not exists 'ddex_retry';
alter type public.audit_action add value if not exists 'ddex_ack';
alter type public.audit_action add value if not exists 'ddex_update';
alter type public.audit_action add value if not exists 'ddex_takedown';
