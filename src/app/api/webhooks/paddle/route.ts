import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getPaddleWebhookSecret } from "@/lib/billing/env";
import { unmarshalPaddleWebhook } from "@/lib/billing/paddle.server";
import { envelopeFromSdkEvent, isHandledPaddleEvent } from "@/lib/billing/webhook-map";
import {
  applyPaddleWebhookEvent,
  markWebhookProcessed,
  recordWebhookEvent,
} from "@/lib/billing/sync";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIpFromRequest,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { publicErrorMessage } from "@/lib/http/safe-error";

export const runtime = "nodejs";

/**
 * Paddle Billing webhook ingress.
 * Verify signature on the raw body BEFORE any DB mutation.
 * Invalid signature → non-2xx and no DB changes.
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limited = checkRateLimit({
    key: `webhook:paddle:${ip}`,
    ...RATE_LIMITS.webhook,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  const secret = getPaddleWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "PADDLE_WEBHOOK_SECRET missing — fail closed." },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("paddle-signature") || req.headers.get("Paddle-Signature");
  if (!signature?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing Paddle-Signature header." }, { status: 401 });
  }

  let event: Awaited<ReturnType<typeof unmarshalPaddleWebhook>>;
  try {
    event = await unmarshalPaddleWebhook(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Paddle webhook signature.";
    if (message.includes("PADDLE_ENVIRONMENT") || message.includes("PADDLE_WEBHOOK_SECRET")) {
      return NextResponse.json({ ok: false, error: message }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "Invalid Paddle webhook signature." }, { status: 401 });
  }

  const envelope = envelopeFromSdkEvent(event);

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Service role not configured — cannot persist webhook." },
      { status: 503 }
    );
  }

  try {
    const recorded = await recordWebhookEvent({ supabase, envelope });
    if (recorded.duplicate && recorded.processed) {
      return NextResponse.json({ ok: true, duplicate: true, eventId: envelope.eventId });
    }

    if (isHandledPaddleEvent(envelope.eventType)) {
      const result = await applyPaddleWebhookEvent({ supabase, envelope });
      await markWebhookProcessed(
        supabase,
        envelope.eventId,
        result.applied ? null : result.reason ?? null
      );
    } else {
      await markWebhookProcessed(supabase, envelope.eventId, "unhandled_event");
    }

    return NextResponse.json({ ok: true, eventId: envelope.eventId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    return NextResponse.json(
      { ok: false, error: publicErrorMessage(message, "Webhook processing failed") },
      { status: 500 }
    );
  }
}
