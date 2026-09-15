-- NEXO login email OTP — audit_action enum extensions (must commit before use)
-- LOGIN_PASSWORD_SUCCESS, OTP_SENT/RESENT/FAILED/VERIFIED/EXPIRED (DB: snake_case)

alter type public.audit_action add value if not exists 'login_password_success';
alter type public.audit_action add value if not exists 'otp_sent';
alter type public.audit_action add value if not exists 'otp_resent';
alter type public.audit_action add value if not exists 'otp_failed';
alter type public.audit_action add value if not exists 'otp_verified';
alter type public.audit_action add value if not exists 'otp_expired';
