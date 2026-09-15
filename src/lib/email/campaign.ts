import { toCanonicalEmailStatus, type CanonicalEmailStatus } from "./status";
import type { EmailEventType, StoredTemplateCategory } from "./types";

export function campaignIdempotencyKey(
  campaignId: string,
  recipientUserId: string
): string {
  return `MANUAL_SEND:${campaignId}:${recipientUserId}`;
}

export function eventTypeForTemplateCategory(
  category: StoredTemplateCategory | string
): EmailEventType {
  if (category === "newsletter") return "newsletter";
  return "manual.send";
}

export function parseSelectedUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      ids.add(id);
    }
  }
  return [...ids];
}

export const MANUAL_SEND_MAX_RECIPIENTS = 2000;

export function summarizeSendResults(
  statuses: Array<{ status: string }>
): Record<CanonicalEmailStatus, number> {
  const counts: Record<CanonicalEmailStatus, number> = {
    queued: 0,
    skipped: 0,
    sent: 0,
    failed: 0,
  };
  for (const row of statuses) {
    counts[toCanonicalEmailStatus(row.status)] += 1;
  }
  return counts;
}

/** True when every processed row is a truthful non-success (never invent sent). */
export function sendOutcomeMessage(
  counts: Record<string, number>,
  providerConfigured: boolean
): string {
  const queued = counts.queued ?? counts.pending ?? 0;
  const skipped = counts.skipped ?? counts.unavailable ?? 0;
  const sent = counts.sent ?? 0;
  const failed = counts.failed ?? 0;
  const total = queued + skipped + sent + failed;
  if (total === 0) return "No events were enqueued.";
  if (!providerConfigured) {
    return `Enqueued ${total} event(s). Zoho SMTP is not configured — statuses stay queued or skipped. Nothing was marked sent.`;
  }
  const parts = [
    queued ? `${queued} queued` : null,
    skipped ? `${skipped} skipped` : null,
    sent ? `${sent} sent` : null,
    failed ? `${failed} failed` : null,
  ].filter(Boolean);
  return `Processed ${total} event(s): ${parts.join(", ")}. SENT only after the provider accepted the send.`;
}
