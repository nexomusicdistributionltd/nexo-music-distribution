import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getPaymentWebhookSecret } from "./config";

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

export function extractPayoutWebhookEventId(payload: Record<string, unknown>): string | null {
  const id =
    (typeof payload.event_id === "string" && payload.event_id) ||
    (typeof payload.eventId === "string" && payload.eventId) ||
    (typeof payload.id === "string" && payload.id) ||
    null;
  return id;
}

export function extractPayoutWebhookEventType(payload: Record<string, unknown>): string {
  if (typeof payload.event_type === "string") return payload.event_type;
  if (typeof payload.type === "string") return payload.type;
  return "unknown";
}
