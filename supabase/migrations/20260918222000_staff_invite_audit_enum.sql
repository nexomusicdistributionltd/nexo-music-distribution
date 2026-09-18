-- NEXO — audit vocabulary for administrator-created staff invitations.
-- Kept separate so PostgreSQL commits the enum value before later functions use it.
alter type public.audit_action add value if not exists 'staff_invite';
