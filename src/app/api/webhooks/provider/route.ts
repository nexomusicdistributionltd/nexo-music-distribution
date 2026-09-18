import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getServiceRoleKey } from "@/lib/supabase/admin";
import { getConfiguredProviderName } from "@/lib/provider/config";
import { getProviderWebhookRuntimeSettings } from "@/lib/provider/webhook-settings";
import {
  verifyProviderWebhookSignature,
  extractWebhookEventId,
  extractWebhookEventType,
} from "@/lib/distribution/webhook";
import { mapProviderStatusToRelease } from "@/lib/distribution/types";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIpFromRequest,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { publicErrorMessage } from "@/lib/http/safe-error";

export const runtime = "nodejs";

function serviceClient() {
  const { url } = getSupabaseEnv();
  const key = getServiceRoleKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Provider webhook ingress.
 * Fails closed when PROVIDER_WEBHOOK_SECRET missing or signature invalid.
 * Idempotent by (provider_name, event_id).
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limited = checkRateLimit({
    key: `webhook:provider:${ip}`,
    ...RATE_LIMITS.webhook,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  const rawBody = await req.text();
  const webhookSettings = await getProviderWebhookRuntimeSettings();
  const signature =
    req.headers.get(webhookSettings.signatureHeader) ||
    req.headers.get("x-provider-signature") ||
    req.headers.get("x-signature") ||
    req.headers.get("x-hub-signature-256");

  const verification = await verifyProviderWebhookSignature({
    rawBody,
    signatureHeader: signature,
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = extractWebhookEventId(payload);
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "event id required" }, { status: 400 });
  }

  const eventType = extractWebhookEventType(payload);
  const providerName = getConfiguredProviderName() ?? "not_connected";
  const mapped =
    mapProviderStatusToRelease(
      typeof payload.status === "string"
        ? payload.status
        : typeof (payload.data as { status?: string } | undefined)?.status === "string"
          ? (payload.data as { status: string }).status
          : eventType
    ) ?? null;

  const releaseId =
    typeof payload.release_id === "string"
      ? payload.release_id
      : typeof payload.releaseId === "string"
        ? payload.releaseId
        : null;

  const supabase = serviceClient();
  if (!supabase) {
    // Still fail closed on signature; cannot persist without service role
    if (!verification.ok) {
      return NextResponse.json(
        { ok: false, error: verification.reason },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Service role not configured — cannot persist webhook" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.rpc("process_provider_webhook_event", {
    p_provider_name: providerName,
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload: payload,
    p_signature_valid: verification.ok,
    p_release_id: releaseId,
    p_mapped_status: verification.ok ? mapped : null,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: publicErrorMessage(error.message, "Webhook processing failed") }, { status: 500 });
  }

  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, error: verification.reason, event: data },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true, event: data });
}
