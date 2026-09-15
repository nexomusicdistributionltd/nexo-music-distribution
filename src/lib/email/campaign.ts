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
): Record<string, number> {
  const counts: Record<string, number> = {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    unavailable: 0,
  };
  for (const row of statuses) {
    const s = row.status;
    if (s in counts) counts[s] += 1;
  }
  return counts;
}

/** True when every processed row is a truthful non-success (never invent sent). */
export function sendOutcomeMessage(
  counts: Record<string, number>,
  providerConfigured: boolean
): string {
  const total =
    (counts.pending ?? 0) +
    (counts.processing ?? 0) +
    (counts.sent ?? 0) +
    (counts.failed ?? 0) +
    (counts.unavailable ?? 0);
  if (total === 0) return "No events were enqueued.";
  if (!providerConfigured) {
    return `Enqueued ${total} event(s). EMAIL_PROVIDER is not configured — statuses stay pending or unavailable. Nothing was marked sent.`;
  }
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`);
  return `Processed ${total} event(s): ${parts.join(", ")}. SENT only after the provider accepted the send.`;
}
