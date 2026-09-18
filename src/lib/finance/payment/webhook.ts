import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getPaymentWebhookSecret } from "./config";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function scalarString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function verifyPayoutWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null | undefined;
}): { ok: boolean; reason?: string } {
  const secret = getPaymentWebhookSecret();
  if (!secret) {
    return { ok: false, reason: "PAYMENT_WEBHOOK_SECRET missing — fail closed." };
  }
  if (!input.signatureHeader?.trim()) {
    return { ok: false, reason: "Missing payout webhook signature." };
  }
  const provided = input.signatureHeader.replace(/^sha256=/i, "").trim();
  const expected = createHmac("sha256", secret).update(input.rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "Invalid payout webhook signature." };
    }
  } catch {
    return { ok: false, reason: "Invalid payout webhook signature encoding." };
  }
  return { ok: true };
}

export function extractPayoutWebhookEventId(
  payload: JsonRecord,
  rawBody?: string
): string | null {
  const data = asRecord(payload.data);
  const candidates = [
    payload.event_id,
    payload.eventId,
    payload.event_uuid,
    payload.eventUuid,
    payload.webhook_id,
    payload.webhookId,
    payload.notification_id,
    payload.notificationId,
    data?.event_id,
    data?.eventId,
    data?.webhook_id,
    data?.webhookId,
  ];
  for (const candidate of candidates) {
    const value = scalarString(candidate);
    if (value) return value;
  }
  if (rawBody) {
    return `body_${createHash("sha256").update(rawBody, "utf8").digest("hex")}`;
  }
  return null;
}

export function extractPayoutWebhookEventType(payload: JsonRecord): string {
  const data = asRecord(payload.data);
  const candidate =
    payload.event_type ??
    payload.eventType ??
    payload.type ??
    data?.event_type ??
    data?.eventType ??
    data?.type;
  return scalarString(candidate) ?? "unknown";
}

export function extractProviderPayoutReference(payload: JsonRecord): string | null {
  const data = asRecord(payload.data);
  const payout = asRecord(payload.payout);
  const nestedPayout = asRecord(data?.payout);
  const candidates = [
    payload.provider_payout_id,
    payload.providerPayoutId,
    payload.payout_id,
    payload.payoutId,
    payout?.id,
    payout?.payout_id,
    payout?.payoutId,
    data?.provider_payout_id,
    data?.providerPayoutId,
    data?.payout_id,
    data?.payoutId,
    nestedPayout?.id,
    nestedPayout?.payout_id,
    nestedPayout?.payoutId,
  ];
  for (const candidate of candidates) {
    const value = scalarString(candidate);
    if (value) return value;
  }
  return null;
}

export function extractPayoutPaymentReference(payload: JsonRecord): string | null {
  const data = asRecord(payload.data);
  const payout = asRecord(payload.payout);
  const nestedPayout = asRecord(data?.payout);
  const candidates = [
    payload.payment_reference,
    payload.paymentReference,
    payload.reference,
    payout?.payment_reference,
    payout?.paymentReference,
    payout?.reference,
    data?.payment_reference,
    data?.paymentReference,
    data?.reference,
    nestedPayout?.payment_reference,
    nestedPayout?.paymentReference,
    nestedPayout?.reference,
  ];
  for (const candidate of candidates) {
    const value = scalarString(candidate);
    if (value) return value;
  }
  return null;
}

export function extractPayoutMappedStatus(payload: JsonRecord): "paid" | "failed" | null {
  const data = asRecord(payload.data);
  const payout = asRecord(payload.payout);
  const nestedPayout = asRecord(data?.payout);
  const rawStatus =
    scalarString(payload.status) ??
    scalarString(payout?.status) ??
    scalarString(data?.status) ??
    scalarString(nestedPayout?.status);

  if (rawStatus) {
    const normalized = rawStatus.toLowerCase().replace(/[\s-]+/g, "_");
    if (["paid", "completed", "succeeded", "success"].includes(normalized)) return "paid";
    if (["failed", "failure", "rejected", "error"].includes(normalized)) return "failed";
  }

  const eventType = extractPayoutWebhookEventType(payload)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const terminal = eventType.split(/[.:/]/).filter(Boolean).at(-1) ?? eventType;
  if (["paid", "completed", "succeeded", "success"].includes(terminal)) return "paid";
  if (["failed", "failure", "rejected", "error"].includes(terminal)) return "failed";
  return null;
}
