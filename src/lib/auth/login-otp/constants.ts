/** Login email OTP second-step — shared constants (no secrets). */

export const LOGIN_OTP_PURPOSE = "login_email_otp" as const;
export type LoginOtpPurpose = typeof LOGIN_OTP_PURPOSE;

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60_000;
export const OTP_DIGITS = 6;
export const OTP_MIN = 0;
export const OTP_MAX_EXCLUSIVE = 1_000_000;

/** DB + in-memory generation caps (per user / IP). */
export const OTP_GENERATE_MAX_PER_WINDOW = 8;
export const OTP_GENERATE_WINDOW_MS = 15 * 60_000;

export const LOGIN_OTP_VERIFY_PATH = "/login/verify";
export const LOGIN_PATH = "/login";
export const LOGOUT_API_PATH = "/api/auth/logout";
export const OTP_START_API_PATH = "/api/auth/otp/start";
export const OTP_RESEND_API_PATH = "/api/auth/otp/resend";
export const OTP_VERIFY_API_PATH = "/api/auth/otp/verify";

export const NEXO_OTP_CHALLENGE_COOKIE = "nexo_otp_challenge";

export const OTP_EMAIL_SUBJECT = "Your Nexo Login Verification Code";

/** Routes a signed-in, OTP-pending user may access (plus auth/verify/cancel). */
export const OTP_PENDING_ALLOW_PREFIXES = [
  LOGIN_OTP_VERIFY_PATH,
  "/reset-password",
  "/verify-email",
  "/auth",
  "/forgot-password",
  "/register",
  "/login",
  "/nexo-admin",
  "/api/auth/otp",
  "/api/auth/logout",
] as const;
