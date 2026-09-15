import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import { authorizeAndPrepareCheckout } from "@/lib/billing/checkout";
import { buildCheckoutCustomData } from "@/lib/billing/checkout";
import { getSiteUrl } from "@/lib/site-url";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIpFromRequest,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { publicErrorMessage } from "@/lib/http/safe-error";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limited = checkRateLimit({
    key: `billing:checkout:${ip}`,
    ...RATE_LIMITS.authSensitive,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Sign in to start checkout." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const prepared = authorizeAndPrepareCheckout({
    authenticated: true,
    roles: ctx.roles,
    profileAccountType: ctx.profile?.account_type,
    email: ctx.email,
    request: {
      planId: typeof body.planId === "string" ? body.planId : "",
      interval: typeof body.interval === "string" ? body.interval : "",
    },
    client: {
      priceId: body.priceId,
      amount: body.amount,
      userId: body.userId,
      customerId: body.customerId,
      accountType: body.accountType,
    },
    origin: getSiteUrl(),
  });

  if (!prepared.ok) {
    return NextResponse.json({ ok: false, error: prepared.error }, { status: prepared.status });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Service role not configured — cannot create checkout intent." },
      { status: 503 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("billing_checkout_intents")
      .insert({
        user_id: ctx.userId,
        account_type: ctx.roles.includes("label") ? "label" : "artist",
        plan_id: prepared.planId,
        interval: prepared.interval,
        paddle_price_id: prepared.priceId,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      throw error ?? new Error("Failed to create checkout intent");
    }

    return NextResponse.json({
      ok: true,
      priceId: prepared.priceId,
      email: prepared.email,
      customData: buildCheckoutCustomData({
        intentId: data.id,
        planId: prepared.planId,
        interval: prepared.interval,
      }),
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        successUrl: prepared.successUrl,
        allowLogout: false,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json(
      { ok: false, error: publicErrorMessage(message, "Could not start checkout") },
      { status: 500 }
    );
  }
}
