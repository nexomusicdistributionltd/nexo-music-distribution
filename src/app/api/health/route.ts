import { NextResponse } from "next/server";
import { DEFAULT_SITE_URL, getSiteUrl, isForbiddenAuthHost } from "@/lib/site-url";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createServiceClient, getServiceRoleKeyStatus } from "@/lib/supabase/admin";
import { loginOtpHealthSnapshot } from "@/lib/auth/login-otp/env";
import { readProviderConfig } from "@/lib/provider/config";
import { getPaymentConnectionState } from "@/lib/finance/payment";
import { isZohoSmtpConfigured } from "@/lib/email/zoho-smtp";
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
  const emailConfigured = isZohoSmtpConfigured();
  const loginOtp = loginOtpHealthSnapshot(process.env, emailConfigured);
  const serviceRoleStatus = getServiceRoleKeyStatus();

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

  let loginOtpTables: "ok" | "missing" | "skipped" | "error" = "skipped";
  if (serviceRoleStatus === "present") {
    try {
      const service = createServiceClient();
      const { error } = await service.from("login_otp_challenges").select("id").limit(1);
      if (!error) {
        loginOtpTables = "ok";
      } else if (/does not exist|schema cache|relation .*login_otp/i.test(error.message)) {
        loginOtpTables = "missing";
      } else {
        loginOtpTables = "error";
      }
    } catch {
      loginOtpTables = "error";
    }
  }

  const body = {
    ok: true,
    status: "up",
    time: new Date().toISOString(),
    app: "nexo-music-distribution",
    site,
    checks: {
      supabaseEnv: env.configured ? "configured" : "missing",
      serviceRole: serviceRoleStatus === "present" ? "present" : serviceRoleStatus === "invalid_anon" ? "invalid" : "absent",
      database: db,
      storageBuckets: "configured_in_migrations",
      distributionProvider: provider.connected ? "CONNECTED" : "NOT CONNECTED",
      paymentProvider: payment.connected ? "CONNECTED" : "NOT CONNECTED",
      royaltyProvider: royaltyConfigured ? "CREDENTIALS_PRESENT" : "NOT CONNECTED",
      fxProvider: fxConfigured ? "CREDENTIALS_PRESENT" : "NOT CONNECTED",
      email: emailConfigured ? "CREDENTIALS_PRESENT" : "NOT CONNECTED",
      publishingProCmo: "NOT CONNECTED",
      loginOtp: {
        ready: loginOtp.sendReady && loginOtpTables === "ok",
        serviceRole: loginOtp.serviceRole,
        smtp: loginOtp.smtp,
        pepper: loginOtp.pepper,
        tables: loginOtpTables,
      },
    },
  };

  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
