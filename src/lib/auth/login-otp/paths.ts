import {
  LOGIN_OTP_VERIFY_PATH,
  LOGIN_PATH,
  OTP_PENDING_ALLOW_PREFIXES,
} from "@/lib/auth/login-otp/constants";

export function startsWithPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function startsWithAnyPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => startsWithPrefix(pathname, p));
}

export function isOtpPendingAllowedPath(pathname: string): boolean {
  return startsWithAnyPrefix(pathname, OTP_PENDING_ALLOW_PREFIXES);
}

export function loginVerifyHref(from?: string | null, extra?: Record<string, string>): string {
  const q = new URLSearchParams();
  if (from && from.startsWith("/") && !from.startsWith("//")) {
    q.set("from", from);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
    }
  }
  const qs = q.toString();
  return qs ? `${LOGIN_OTP_VERIFY_PATH}?${qs}` : LOGIN_OTP_VERIFY_PATH;
}

export function loginHref(reason?: string | null): string {
  if (!reason) return LOGIN_PATH;
  const q = new URLSearchParams();
  q.set("reason", reason);
  return `${LOGIN_PATH}?${q.toString()}`;
}
