import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getProviderWebhookSecret } from "@/lib/provider/config";
import { ProviderWebhookRejectedError } from "@/lib/provider/errors";
import { loadDistributionWebhookSecret } from "@/lib/provider/oauth/store";

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

/**
 * Verify provider webhook signature.
 * Fails closed when no dedicated Distribution Engine / provider webhook secret exists.
 *
 * This verifier intentionally implements only the currently supported HMAC-SHA256 contract.
 * Do not reuse OAuth client secrets or accept unsigned payloads.
 */
export function verifyProviderWebhookSignature(options: {
  rawBody: string;
  signatureHeader: string | null;
}): { ok: true } | { ok: false; reason: string } {
  const secret = getProviderWebhookSecret();
  if (!secret) {
    return {
      ok: false,
      reason:
        "Distribution webhook secret is not configured — webhook rejected (fail closed).",
    };
  }
  if (!options.signatureHeader || !options.signatureHeader.trim()) {
    return { ok: false, reason: "Missing signature header." };
  }

  const provided = options.signatureHeader.trim().replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret)
    .update(options.rawBody, "utf8")
    .digest("hex");

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

export async function verifyProviderWebhookSignatureAsync(options: {
  rawBody: string;
  signatureHeader: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const envSecret = getProviderWebhookSecret();
  const storedSecret = envSecret ? null : await loadDistributionWebhookSecret();
  const secret = envSecret ?? storedSecret;
  if (!secret) {
    return {
      ok: false,
      reason:
        "Distribution webhook secret is not configured — webhook rejected (fail closed).",
    };
  }
  if (!options.signatureHeader || !options.signatureHeader.trim()) {
    return { ok: false, reason: "Missing signature header." };
  }

  const provided = options.signatureHeader.trim().replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret)
    .update(options.rawBody, "utf8")
    .digest("hex");

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

/**
 * Prefer explicit webhook/event identifiers. If a provider does not send one,
 * derive a deterministic body hash so exact retries dedupe without confusing a
 * release identifier with an event identifier.
 */
export function extractWebhookEventId(
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
    payload.uuid,
    data?.event_id,
    data?.eventId,
    data?.event_uuid,
    data?.eventUuid,
    data?.webhook_id,
    data?.webhookId,
    data?.notification_id,
    data?.notificationId,
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

export function extractWebhookEventType(payload: JsonRecord): string {
  const data = asRecord(payload.data);
  const event = asRecord(payload.event);
  const candidate =
    payload.type ??
    payload.event_type ??
    payload.eventType ??
    event?.type ??
    data?.event_type ??
    data?.eventType ??
    "unknown";
  return scalarString(candidate) ?? "unknown";
}

/**
 * Extract the upstream release identifier. This is intentionally NOT assumed
 * to be Nexo's UUID; the webhook route resolves it server-side against
 * releases.provider_release_id / distribution_jobs.provider_release_id.
 */
export function extractProviderReleaseReference(payload: JsonRecord): string | null {
  const data = asRecord(payload.data);
  const release = asRecord(payload.release);
  const nestedRelease = asRecord(data?.release);
  const candidates = [
    payload.provider_release_id,
    payload.providerReleaseId,
    payload.release_id,
    payload.releaseId,
    release?.id,
    release?.release_id,
    release?.releaseId,
    data?.provider_release_id,
    data?.providerReleaseId,
    data?.release_id,
    data?.releaseId,
    nestedRelease?.id,
    nestedRelease?.release_id,
    nestedRelease?.releaseId,
  ];
  for (const candidate of candidates) {
    const value = scalarString(candidate);
    if (value) return value;
  }
  return null;
}

export function extractProviderStatus(payload: JsonRecord): string | null {
  const data = asRecord(payload.data);
  const release = asRecord(payload.release);
  const nestedRelease = asRecord(data?.release);
  const candidates = [
    payload.status,
    payload.release_status,
    payload.releaseStatus,
    release?.status,
    release?.release_status,
    release?.releaseStatus,
    data?.status,
    data?.release_status,
    data?.releaseStatus,
    nestedRelease?.status,
    nestedRelease?.release_status,
    nestedRelease?.releaseStatus,
  ];
  for (const candidate of candidates) {
    const value = scalarString(candidate);
    if (value) return value;
  }
  return null;
}
