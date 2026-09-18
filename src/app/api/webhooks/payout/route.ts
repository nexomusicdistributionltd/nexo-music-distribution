import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getServiceRoleKey } from "@/lib/supabase/admin";
import {
  getConfiguredPaymentProviderName,
  verifyPayoutWebhookSignature,
  extractPayoutWebhookEventId,
  extractPayoutWebhookEventType,
  extractProviderPayoutReference,
  extractPayoutPaymentReference,
  extractPayoutMappedStatus,
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function resolveInternalPayoutId(
  supabase: ReturnType<typeof createClient>,
  payoutReference: string | null
): Promise<string | null> {
  if (!payoutReference) return null;

  if (isUuid(payoutReference)) {
    const { data: direct } = await supabase
      .from("payouts")
      .select("id")
      .eq("id", payoutReference)
      .maybeSingle();
    if (typeof direct?.id === "string") return direct.id;
  }

  const { data: rows } = await supabase
    .from("payouts")
    .select("id")
    .eq("provider_payout_id", payoutReference)
    .limit(2);

  return rows?.length === 1 && typeof rows[0]?.id === "string" ? rows[0].id : null;
}

/**
 * Payout provider webhook ingress.
 * Fails closed when PAYMENT_WEBHOOK_SECRET is missing or signature verification fails.
 * Only a verified webhook is allowed to resolve or mutate a payout.
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

  let payload: Record<string, unknown>;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = extractPayoutWebhookEventId(payload, rawBody);
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "event id required" }, { status: 400 });
  }

  const eventType = extractPayoutWebhookEventType(payload);
  const providerName = getConfiguredPaymentProviderName() ?? "not_connected";
  const payoutReference = extractProviderPayoutReference(payload);
  const paymentReference = extractPayoutPaymentReference(payload);
  const mappedStatus = extractPayoutMappedStatus(payload);

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

  const payoutId = verification.ok
    ? await resolveInternalPayoutId(supabase, payoutReference)
    : null;

  if (verification.ok) {
    const adapter = getPaymentProvider();
    if (adapter.connected) {
      await adapter.handlePayoutWebhook({
        providerName,
        eventId,
        eventType,
        rawBody,
        signatureHeader: signature,
        payload,
      });
    }
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
    return NextResponse.json(
      { ok: false, error: publicErrorMessage(error.message, "Webhook processing failed") },
      { status: 500 }
    );
  }

  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, error: verification.reason, event: data },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    matchedPayout: Boolean(payoutId),
    mappedStatus,
    event: data,
  });
}
