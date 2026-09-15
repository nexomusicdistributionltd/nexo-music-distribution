/**
 * Extract Supabase Auth session_id from a JWT access token.
 * Edge-safe (no Node Buffer). Never logs the token.
 */

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  if (typeof atob === "function") {
    return atob(padded);
  }
  return Buffer.from(padded, "base64").toString("utf8");
}

export function sessionIdFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken || typeof accessToken !== "string") return null;
  const parts = accessToken.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const json = JSON.parse(base64UrlDecode(parts[1])) as { session_id?: unknown };
    const sid = json.session_id;
    if (typeof sid !== "string") return null;
    const trimmed = sid.trim();
    if (trimmed.length < 8 || trimmed.length > 128) return null;
    return trimmed;
  } catch {
    return null;
  }
}
