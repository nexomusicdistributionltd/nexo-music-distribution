/** Canonical Batch 5 outbox statuses on public.email_outbound_events. */
export const CANONICAL_EMAIL_STATUSES = ["queued", "skipped", "failed", "sent"] as const;

export type CanonicalEmailStatus = (typeof CANONICAL_EMAIL_STATUSES)[number];

/** Legacy PR #5 vocabulary plus canonical — never invent sent. */
export type EmailEventStatus =
  | CanonicalEmailStatus
  | "pending"
  | "processing"
  | "unavailable";

const UNTRUSTED_PROVIDERS = new Set([
  "none",
  "not_connected",
  "fake",
  "test",
  "null",
  "resend",
  "sendgrid",
  "mailgun",
  "postmark",
  "",
]);

export function toCanonicalEmailStatus(status: string): CanonicalEmailStatus {
  switch (status) {
    case "sent":
      return "sent";
    case "failed":
      return "failed";
    case "skipped":
    case "unavailable":
      return "skipped";
    case "queued":
    case "pending":
    case "processing":
      return "queued";
    default:
      return "failed";
  }
}

export function isCanonicalEmailStatus(status: string): status is CanonicalEmailStatus {
  return (CANONICAL_EMAIL_STATUSES as readonly string[]).includes(status);
}

/**
 * SENT requires a real provider identity and a provider message id.
 * Matches protect_email_outbound_sent (plus "null", which is the unconfigured adapter name).
 */
export function canMarkOutboundSent(
  provider: string | null | undefined,
  messageId: string | null | undefined
): boolean {
  const p = (provider ?? "").trim().toLowerCase();
  const id = (messageId ?? "").trim();
  return Boolean(p) && Boolean(id) && !UNTRUSTED_PROVIDERS.has(p);
}
