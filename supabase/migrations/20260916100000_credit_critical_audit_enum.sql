-- NEXO credit-critical ops — audit_action values (must commit before use)
alter type public.audit_action add value if not exists 'playlist_pitch_create';
alter type public.audit_action add value if not exists 'playlist_pitch_submit';
alter type public.audit_action add value if not exists 'playlist_pitch_review';
alter type public.audit_action add value if not exists 'dsp_profile_update';
alter type public.audit_action add value if not exists 'contact_reply';
