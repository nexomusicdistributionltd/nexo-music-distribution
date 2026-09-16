/** Parse and validate outbound address lists. Never trust client-typed garbage. */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const MAX_COMPOSE_RECIPIENTS = 50;

export function normalizeEmailAddress(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

export function isValidEmailAddress(email: string): boolean {
  if (!email || email.length > 320) return false;
  return EMAIL_RE.test(email);
}

/** Split To/CC/BCC fields (comma or newline). Drops invalid tokens. */
export function parseAddressList(raw: unknown, limit = MAX_COMPOSE_RECIPIENTS): string[] {
  if (typeof raw !== "string" && !Array.isArray(raw)) return [];
  const parts = Array.isArray(raw) ? raw : raw.split(/[\s,;]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const email = normalizeEmailAddress(part);
    if (!isValidEmailAddress(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
    if (out.length >= limit) break;
  }
  return out;
}

export function uniqueAddresses(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const email of list) {
      const n = normalizeEmailAddress(email);
      if (!isValidEmailAddress(n) || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export function excludeAddress(list: string[], exclude: string): string[] {
  const skip = normalizeEmailAddress(exclude);
  return list.filter((e) => e !== skip);
}

export function mergeAddressField(current: string, emails: string[]): string {
  return uniqueAddresses(parseAddressList(current), emails).join(", ");
}
