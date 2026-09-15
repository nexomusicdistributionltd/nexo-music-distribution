import { safeRedirectPath } from "@/lib/auth/safeRedirect";
import { authEmailRedirectUrl } from "@/lib/site-url";

export const RESET_PASSWORD_PATH = "/reset-password";

/**
 * resetPasswordForEmail redirectTo — the actual Set New Password route.
 * Live GoTrue recovery still delivers `#access_token&refresh_token&type=recovery`
 * on this path (hash is never sent to /auth/callback). PKCE `?code=` and OTP
 * `token_hash` that land here are forwarded by resetPasswordForwardPath.
 */
export const RECOVERY_EMAIL_REDIRECT_PATH = RESET_PASSWORD_PATH;

/** Absolute redirectTo sent to GoTrue — official production host only. */
export function recoveryEmailRedirectTo(): string {
  return authEmailRedirectUrl(RECOVERY_EMAIL_REDIRECT_PATH);
}

export function isResetPasswordPath(path: string): boolean {
  return path === RESET_PASSWORD_PATH || path.startsWith(`${RESET_PASSWORD_PATH}?`);
}

export function authCallbackNext(
  nextParam: string | null | undefined,
  otpType?: string | null
): string {
  const fallback = otpType === "recovery" ? RESET_PASSWORD_PATH : "/dashboard";
  return safeRedirectPath(nextParam, [], fallback);
}

export function recoveryFailurePath(next: string, otpType?: string | null): string {
  if (otpType === "recovery" || isResetPasswordPath(next)) {
    return `${RESET_PASSWORD_PATH}?reason=invalid-or-expired`;
  }
  return "/login?reason=auth-required";
}

/**
 * If a recovery/confirm link landed on /reset-password with auth params,
 * forward to the existing SSR route that establishes the session.
 * Prefer token_hash (verifyOtp) over PKCE code — never run both.
 */
export function resetPasswordForwardPath(input: {
  code?: string | null;
  token_hash?: string | null;
  type?: string | null;
}): string | null {
  const tokenHash = input.token_hash?.trim() || "";
  const type = input.type?.trim() || "";
  const code = input.code?.trim() || "";

  if (tokenHash && type) {
    const q = new URLSearchParams();
    q.set("token_hash", tokenHash);
    q.set("type", type);
    q.set("next", RESET_PASSWORD_PATH);
    return `/auth/confirm?${q.toString()}`;
  }
  if (code) {
    const q = new URLSearchParams();
    q.set("code", code);
    q.set("next", RESET_PASSWORD_PATH);
    return `/auth/callback?${q.toString()}`;
  }
  return null;
}
