-- NEXO — DDEX ERN 4.3.2 production (additive)
-- Private ERN XML storage + ddex_messages columns. No DSP fake connections.

alter type public.audit_action add value if not exists 'ddex_generate';
alter type public.audit_action add value if not exists 'ddex_validate';
alter type public.audit_action add value if not exists 'ddex_download';
