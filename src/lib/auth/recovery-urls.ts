import { safeRedirectPath } from "@/lib/auth/safeRedirect";

export const RESET_PASSWORD_PATH = "/reset-password";

/** PKCE recovery redirectTo — exchanged by /auth/callback, then next=/reset-password. */
export const RECOVERY_EMAIL_REDIRECT_PATH = "/auth/callback?next=/reset-password";

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
