/** Audit action names for login OTP (DB snake_case; product names in comments). */

export const LOGIN_OTP_AUDIT = {
  LOGIN_PASSWORD_SUCCESS: "login_password_success",
  OTP_SENT: "otp_sent",
  OTP_RESENT: "otp_resent",
  OTP_FAILED: "otp_failed",
  OTP_VERIFIED: "otp_verified",
  OTP_EXPIRED: "otp_expired",
  LOGOUT: "logout",
} as const;

export type LoginOtpAuditAction = (typeof LOGIN_OTP_AUDIT)[keyof typeof LOGIN_OTP_AUDIT];

const FORBIDDEN_META_KEYS = [
  "password",
  "token",
  "access_token",
  "refresh_token",
  "service_role_key",
  "otp",
  "otp_code",
  "code",
  "code_hash",
  "plaintext_otp",
  "hash",
];

export function sanitizeOtpAuditMetadata(
  metadata: Record<string, unknown> = {}
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (FORBIDDEN_META_KEYS.includes(k.toLowerCase())) continue;
    if (typeof v === "string" && /^\d{6}$/.test(v)) continue;
    safe[k] = v;
  }
  return safe;
}
