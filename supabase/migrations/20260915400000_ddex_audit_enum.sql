-- NEXO Label roster / DDEX foundation — audit_action enum extensions (must commit before use)
alter type public.audit_action add value if not exists 'roster_artist_create';
alter type public.audit_action add value if not exists 'roster_artist_update';
alter type public.audit_action add value if not exists 'release_deal_upsert';
alter type public.audit_action add value if not exists 'ddex_message_record';
