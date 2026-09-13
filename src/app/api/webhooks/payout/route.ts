import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getServiceRoleKey } from "@/lib/supabase/admin";
import {
  getConfiguredPaymentProviderName,
  verifyPayoutWebhookSignature,
  extractPayoutWebhookEventId,
  extractPayoutWebhookEventType,
  getPaymentProvider,
} from "@/lib/finance/payment";
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
 * Payout provider webhook ingress.
 * Fail-closed when PAYMENT_WEBHOOK_SECRET missing or signature invalid.
 * Idempotent by (provider_name, event_id).
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limited = checkRateLimit({
    key: `webhook:payout:${ip}`,
    ...RATE_LIMITS.webhook,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  const rawBody = await req.text();
  const signature =
    req.headers.get("x-payment-signature") ||
    req.headers.get("x-provider-signature") ||
    req.headers.get("x-signature");

  const verification = verifyPayoutWebhookSignature({
    rawBody,
    signatureHeader: signature,
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = extractPayoutWebhookEventId(payload);
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "event id required" }, { status: 400 });
  }

  const eventType = extractPayoutWebhookEventType(payload);
  const providerName = getConfiguredPaymentProviderName() ?? "not_connected";

  const payoutId =
    typeof payload.payout_id === "string"
      ? payload.payout_id
      : typeof payload.payoutId === "string"
        ? payload.payoutId
        : null;

  const paymentReference =
    typeof payload.payment_reference === "string"
      ? payload.payment_reference
      : typeof payload.paymentReference === "string"
        ? payload.paymentReference
        : null;

  const mappedStatus =
    typeof payload.status === "string"
      ? payload.status
      : eventType.toLowerCase().includes("paid")
        ? "paid"
        : eventType.toLowerCase().includes("fail")
          ? "failed"
          : null;

  await getPaymentProvider().handlePayoutWebhook({
    providerName,
    eventId,
    eventType,
    rawBody,
    signatureHeader: signature,
    payload,
  });

  const supabase = serviceClient();
  if (!supabase) {
    if (!verification.ok) {
      return NextResponse.json({ ok: false, error: verification.reason }, { status: 401 });
    }
    return NextResponse.json(
      { ok: false, error: "Service role not configured — cannot persist webhook" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.rpc("process_payout_webhook_event", {
    p_provider_name: providerName,
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload: payload,
    p_signature_valid: verification.ok,
    p_payout_id: payoutId,
    p_payment_reference: paymentReference,
    p_mapped_status: verification.ok ? mappedStatus : null,
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
