import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getServiceRoleKey } from "@/lib/supabase/admin";
import { getConfiguredProviderName } from "@/lib/provider/config";
import { loadRuntimeProviderWebhookSecret } from "@/lib/provider/webhook-secret";
import { isDistributionOAuthConfigured } from "@/lib/provider/oauth/config";
import {
  verifyProviderWebhookSignature,
  extractWebhookEventId,
  extractWebhookEventType,
  extractProviderReleaseReference,
  extractProviderStatus,
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function resolveInternalReleaseId(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  releaseReference: string | null
): Promise<string | null> {
  if (!releaseReference) return null;

  // Some internal test callbacks may send Nexo's own UUID. Only accept it after
  // proving that release exists; never pass an arbitrary external string to a UUID RPC.
  if (isUuid(releaseReference)) {
    const { data: direct } = await supabase
      .from("releases")
      .select("id")
      .eq("id", releaseReference)
      .maybeSingle();
    if (typeof direct?.id === "string") return direct.id;
  }

  const { data: releaseRows } = await supabase
    .from("releases")
    .select("id")
    .eq("provider_release_id", releaseReference)
    .limit(2);

  if (releaseRows?.length === 1 && typeof releaseRows[0]?.id === "string") return releaseRows[0].id;
  if ((releaseRows?.length ?? 0) > 1) return null;

  const { data: jobRows } = await supabase
    .from("distribution_jobs")
    .select("release_id")
    .eq("provider_release_id", releaseReference)
    .order("updated_at", { ascending: false })
    .limit(10);

  const releaseIds = [
    ...new Set((jobRows ?? []).map((row) => row.release_id).filter((id): id is string => typeof id === "string" && id.length > 0)),
  ];
  return releaseIds.length === 1 ? releaseIds[0] : null;
}

/**
 * Distribution Engine webhook ingress.
 * Fails closed when the webhook secret is missing or the HMAC signature is invalid.
 * Idempotent by (provider_name, event_id). External provider release identifiers are
 * resolved server-side before any release status mutation.
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
  const signature =
    req.headers.get("x-provider-signature") ||
    req.headers.get("x-signature") ||
    req.headers.get("x-hub-signature-256");

  const runtimeSecret = await loadRuntimeProviderWebhookSecret();
  const verification = verifyProviderWebhookSignature({
    rawBody,
    signatureHeader: signature,
    secretOverride: runtimeSecret?.secret ?? null,
  });

  let payload: Record<string, unknown>;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = extractWebhookEventId(payload, rawBody);
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "event id required" }, { status: 400 });
  }

  const eventType = extractWebhookEventType(payload);
  const providerName = isDistributionOAuthConfigured()
    ? "distribution_engine"
    : getConfiguredProviderName() ?? "not_connected";

  const rawProviderStatus = extractProviderStatus(payload) ?? eventType;
  const mapped = mapProviderStatusToRelease(rawProviderStatus);
  const releaseReference = extractProviderReleaseReference(payload);

  const supabase = serviceClient();
  if (!supabase) {
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

  const releaseId = verification.ok
    ? await resolveInternalReleaseId(supabase, releaseReference)
    : null;

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
    return NextResponse.json(
      {
        ok: false,
        error: publicErrorMessage(error.message, "Webhook processing failed"),
      },
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
    matchedRelease: Boolean(releaseId),
    mappedStatus: mapped,
    event: data,
  });
}
