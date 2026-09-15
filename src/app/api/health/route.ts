import { NextResponse } from "next/server";
import { DEFAULT_SITE_URL, getSiteUrl, isForbiddenAuthHost } from "@/lib/site-url";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getServiceRoleKey } from "@/lib/supabase/admin";
import { readProviderConfig } from "@/lib/provider/config";
import { getPaymentConnectionState } from "@/lib/finance/payment";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + truthful integration states.
 * Never reports healthy/connected for unconfigured providers.
 */
export async function GET() {
  const env = getSupabaseEnv();
  const provider = readProviderConfig();
  const payment = getPaymentConnectionState();
  const royaltyConfigured = Boolean(
    process.env.ROYALTY_PROVIDER_NAME?.trim() &&
      process.env.ROYALTY_PROVIDER_API_KEY?.trim()
  );
  const fxConfigured = Boolean(
    process.env.FX_PROVIDER_NAME?.trim() && process.env.FX_PROVIDER_API_KEY?.trim()
  );
  const emailConfigured = Boolean(
    (process.env.EMAIL_PROVIDER?.trim() || process.env.SMTP_HOST?.trim()) &&
      (process.env.SMTP_PASSWORD?.trim() || process.env.EMAIL_FROM?.trim())
  );

  let db: "ok" | "unreachable" | "unconfigured" = "unconfigured";
  if (env.configured) {
    try {
      const client = createClient(env.url, env.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await client.from("profiles").select("id").limit(1);
      // RLS may deny rows for anon — that still proves DB reachable
      db = error && /fetch|network|ENOTFOUND|ECONNREFUSED/i.test(error.message)
        ? "unreachable"
        : "ok";
      if (error && !/permission|row-level|JWT|PGRST|relation/i.test(error.message) &&
          /fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(error.message)) {
        db = "unreachable";
      }
    } catch {
      db = "unreachable";
    }
  }

  let site = DEFAULT_SITE_URL;
  try {
    const resolved = getSiteUrl();
    const host = new URL(resolved).hostname;
    site = isForbiddenAuthHost(host) ? DEFAULT_SITE_URL : resolved;
  } catch {
    site = DEFAULT_SITE_URL;
  }

  const body = {
    ok: true,
    status: "up",
    time: new Date().toISOString(),
    app: "nexo-music-distribution",
    site,
    checks: {
      supabaseEnv: env.configured ? "configured" : "missing",
      serviceRole: getServiceRoleKey() ? "present" : "absent",
      database: db,
      storageBuckets: "configured_in_migrations",
      distributionProvider: provider.connected ? "CONNECTED" : "NOT CONNECTED",
      paymentProvider: payment.connected ? "CONNECTED" : "NOT CONNECTED",
      royaltyProvider: royaltyConfigured ? "CREDENTIALS_PRESENT" : "NOT CONNECTED",
      fxProvider: fxConfigured ? "CREDENTIALS_PRESENT" : "NOT CONNECTED",
      email: emailConfigured ? "CREDENTIALS_PRESENT" : "NOT CONNECTED",
      publishingProCmo: "NOT CONNECTED",
    },
  };

  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
