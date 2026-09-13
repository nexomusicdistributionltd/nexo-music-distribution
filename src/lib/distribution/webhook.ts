import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getProviderWebhookSecret } from "@/lib/provider/config";
import { ProviderWebhookRejectedError } from "@/lib/provider/errors";

/**
 * Verify provider webhook signature.
 * Fails closed when PROVIDER_WEBHOOK_SECRET is missing.
 */
export function verifyProviderWebhookSignature(options: {
  rawBody: string;
  signatureHeader: string | null;
}): { ok: true } | { ok: false; reason: string } {
  const secret = getProviderWebhookSecret();
  if (!secret) {
    return {
      ok: false,
      reason: "PROVIDER_WEBHOOK_SECRET is not configured — webhook rejected (fail closed).",
    };
  }
  if (!options.signatureHeader || !options.signatureHeader.trim()) {
    return { ok: false, reason: "Missing signature header." };
  }

  const provided = options.signatureHeader.trim().replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret).update(options.rawBody, "utf8").digest("hex");

  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "Signature mismatch." };
    }
  } catch {
    return { ok: false, reason: "Invalid signature encoding." };
  }

  return { ok: true };
}

export function assertWebhookVerified(options: {
  rawBody: string;
  signatureHeader: string | null;
}): void {
  const result = verifyProviderWebhookSignature(options);
  if (!result.ok) {
    throw new ProviderWebhookRejectedError(result.reason);
  }
}

export function extractWebhookEventId(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.event_id,
    payload.eventId,
    payload.id,
    payload.uuid,
    (payload.data as Record<string, unknown> | undefined)?.id,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

export function extractWebhookEventType(payload: Record<string, unknown>): string {
  const t = payload.type ?? payload.event_type ?? payload.eventType ?? "unknown";
  return typeof t === "string" && t.trim() ? t.trim() : "unknown";
}
