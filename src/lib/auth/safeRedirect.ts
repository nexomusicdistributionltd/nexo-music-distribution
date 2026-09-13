import { homePathForRoles, type AppRole } from "@/lib/auth/types";

const DEFAULT_HOME = "/dashboard";
const MAX_LEN = 2048;

function fullyDecode(value: string): string | null {
  let current = value;
  for (let i = 0; i < 5; i++) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) return current;
      current = next;
    } catch {
      return null;
    }
  }
  return current;
}

function hasUnsafeChars(value: string): boolean {
  // Control chars (incl. CR/LF/NULL/TAB) and backslashes enable open-redirect tricks
  return /[\u0000-\u001F\u007F]/.test(value) || value.includes("\\") || /%5c/i.test(value);
}

/**
 * Allow only relative, same-origin paths.
 * Rejects protocol-relative, absolute URLs, backslashes, encoded //, and newlines.
 */
export function isSafeRedirectPath(candidate: string | null | undefined): candidate is string {
  if (!candidate || typeof candidate !== "string") return false;
  if (candidate.length === 0 || candidate.length > MAX_LEN) return false;
  if (hasUnsafeChars(candidate)) return false;
  if (!candidate.startsWith("/")) return false;
  if (candidate.startsWith("//")) return false;

  const decoded = fullyDecode(candidate);
  if (decoded == null) return false;
  if (hasUnsafeChars(decoded)) return false;
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return false;
  // Absolute / scheme URLs after decoding (https:, javascript:, etc.)
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(decoded)) return false;
  if (decoded.includes("://")) return false;
  return true;
}

export function safeRedirectPath(
  candidate: string | null | undefined,
  roles: AppRole[] = [],
  fallback: string = DEFAULT_HOME
): string {
  if (isSafeRedirectPath(candidate)) return candidate;
  if (roles.length > 0) return homePathForRoles(roles);
  return fallback || DEFAULT_HOME;
}
