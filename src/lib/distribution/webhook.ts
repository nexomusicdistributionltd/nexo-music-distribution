import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getProviderWebhookRuntimeSettings } from "@/lib/provider/webhook-settings";
import { ProviderWebhookRejectedError } from "@/lib/provider/errors";

/**
 * Verify provider webhook signature.
 * Fails closed when no provider-issued signing secret is configured.
 */
export async function verifyProviderWebhookSignature(options: {
  rawBody: string;
  signatureHeader: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const settings = await getProviderWebhookRuntimeSettings();
  const secret = settings.secret;
  if (!settings.enabled || !secret) {
    return {
      ok: false,
      reason: "Provider webhook signing is not configured.",
    };
  }
  if (!options.signatureHeader || !options.signatureHeader.trim()) {
    return { ok: false, reason: "Missing webhook signature." };
  }

  const provided = options.signatureHeader.trim().replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret).update(options.rawBody, "utf8").digest("hex");

  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "Webhook signature mismatch." };
    }
  } catch {
    return { ok: false, reason: "Invalid webhook signature encoding." };
  }

  return { ok: true };
}

export async function assertWebhookVerified(options: {
  rawBody: string;
  signatureHeader: string | null;
}): Promise<void> {
  const result = await verifyProviderWebhookSignature(options);
  if (!result.ok) throw new ProviderWebhookRejectedError(result.reason);
}

export function extractWebhookEventId(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.event_id,
    payload.eventId,
    payload.id,
    payload.uuid,
    (payload.data as Record<string, unknown> | undefined)?.id,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function extractWebhookEventType(payload: Record<string, unknown>): string {
  const value = payload.type ?? payload.event_type ?? payload.eventType ?? "unknown";
  return typeof value === "string" && value.trim() ? value.trim() : "unknown";
}
