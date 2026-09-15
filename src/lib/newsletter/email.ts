/** Normalize newsletter email: trim + lower. Empty → "". */
export function normalizeNewsletterEmail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isValidNewsletterEmail(email: string): boolean {
  if (!email || email.length > 320) return false;
  return EMAIL_RE.test(email);
}

/** Active subscribers only — unsubscribed must be excluded from campaigns. */
export function filterActiveSubscriberEmails(
  rows: Array<{ email: string; status: string }>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.status !== "active") continue;
    const email = normalizeNewsletterEmail(row.email);
    if (!isValidNewsletterEmail(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function isUnsubscribeTokenShape(token: unknown): boolean {
  if (typeof token !== "string") return false;
  const t = token.trim();
  return t.length >= 16 && t.length <= 128 && /^[a-fA-F0-9]+$/.test(t);
}
