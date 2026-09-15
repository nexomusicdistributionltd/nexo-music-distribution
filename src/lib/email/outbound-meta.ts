import { toCanonicalEmailStatus } from "./status";

/** Payload keys stored on email_outbound_events (table has no event_type / idempotency columns). */
export const OUTBOUND_META = {
  eventType: "_event_type",
  recipientUserId: "_recipient_user_id",
  idempotencyKey: "_idempotency_key",
  relatedReleaseId: "_related_release_id",
  createdBy: "_created_by",
  attemptCount: "_attempt_count",
} as const;

export type OutboundEventRow = {
  id: string;
  to_email: string;
  template_key: string;
  payload: Record<string, unknown> | null;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  error: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OutboundListItem = {
  id: string;
  event_type: string;
  template_key: string;
  recipient_email: string | null;
  recipient_user_id: string | null;
  related_release_id: string | null;
  status: string;
  provider: string | null;
  provider_message_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
  attempt_count: number;
};

export function payloadRecord(
  payload: unknown
): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

export function payloadString(
  payload: Record<string, unknown>,
  key: string
): string | null {
  const v = payload[key];
  if (typeof v === "string" && v.trim()) return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

export function payloadAttemptCount(payload: Record<string, unknown>): number {
  const v = payload[OUTBOUND_META.attemptCount];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Drop _meta keys so they are not substituted into branded HTML. */
export function templateVarsFromPayload(
  payload: Record<string, unknown>
): Record<string, string | number | null | undefined> {
  const out: Record<string, string | number | null | undefined> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k.startsWith("_")) continue;
    if (v == null) {
      out[k] = v as null;
      continue;
    }
    if (typeof v === "string" || typeof v === "number") {
      out[k] = v;
    }
  }
  return out;
}

export function outboundToListItem(row: OutboundEventRow): OutboundListItem {
  const payload = payloadRecord(row.payload);
  const relatedReleaseId =
    row.related_entity_type === "release" && row.related_entity_id
      ? row.related_entity_id
      : payloadString(payload, OUTBOUND_META.relatedReleaseId);
  const status = toCanonicalEmailStatus(row.status);
  return {
    id: row.id,
    event_type: payloadString(payload, OUTBOUND_META.eventType) ?? "—",
    template_key: row.template_key,
    recipient_email: row.to_email || null,
    recipient_user_id: payloadString(payload, OUTBOUND_META.recipientUserId),
    related_release_id: relatedReleaseId,
    status,
    provider: row.provider,
    provider_message_id: row.provider_message_id,
    error: row.error,
    created_at: row.created_at,
    sent_at: status === "sent" ? row.updated_at : null,
    attempt_count: payloadAttemptCount(payload),
  };
}
