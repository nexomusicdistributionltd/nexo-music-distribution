import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { authorizeCustomerPortal } from "@/lib/billing/portal";
import { getOwnBillingCustomer, getOwnBillingSubscriptions, primarySubscription } from "@/lib/billing/queries";
import { getPaddleServerClient } from "@/lib/billing/paddle.server";
import { publicErrorMessage } from "@/lib/http/safe-error";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIpFromRequest,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limited = checkRateLimit({
    key: `billing:portal:${ip}`,
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
    return NextResponse.json({ ok: false, error: "Sign in to manage billing." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const authz = authorizeCustomerPortal({
    authenticated: true,
    roles: ctx.roles,
    profileAccountType: ctx.profile?.account_type,
    requestedCustomerId: body.customerId ?? body.customer_id,
  });
  if (!authz.ok) {
    return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });
  }

  const customer = await getOwnBillingCustomer(ctx.userId);
  if (!customer?.paddle_customer_id) {
    return NextResponse.json(
      { ok: false, error: "No Paddle customer is linked to this account yet." },
      { status: 404 }
    );
  }

  const subs = await getOwnBillingSubscriptions(ctx.userId);
  const primary = primarySubscription(subs);
  const subscriptionIds = primary?.paddle_subscription_id ? [primary.paddle_subscription_id] : [];

  try {
    const paddle = getPaddleServerClient();
    const session = await paddle.customerPortalSessions.create(
      customer.paddle_customer_id,
      subscriptionIds
    );
    const url = session.urls?.general?.overview;
    if (!url) {
      return NextResponse.json({ ok: false, error: "Portal session did not return a URL." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portal session failed";
    return NextResponse.json(
      { ok: false, error: publicErrorMessage(message, "Could not open the customer portal") },
      { status: 503 }
    );
  }
}
