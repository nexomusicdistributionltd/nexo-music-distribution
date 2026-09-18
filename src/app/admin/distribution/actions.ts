"use server";

import { createHmac, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  queueApprovedRelease,
  submitQueuedRelease,
  syncReleaseStatus,
  requestTakedownAction,
  reinstateReleaseAction,
  retryFailedJob,
} from "@/lib/distribution/actions";
import { defaultUnavailableCatalog, discoverExternalCatalog } from "@/lib/migration/external-catalog";
import {
  ensureProviderWebhookSigningSecret,
  loadProviderWebhookSigningSecret,
  rotateProviderWebhookSigningSecret,
  setProviderWebhookSigningSecret,
} from "@/lib/provider/webhook-secret";
import { getSiteUrl } from "@/lib/site-url";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

function revalidateDist() {
  revalidatePath("/admin/distribution");
  revalidatePath("/admin/distribution/queue");
  revalidatePath("/admin/distribution/submissions");
  revalidatePath("/admin/distribution/delivery");
  revalidatePath("/admin/distribution/webhooks");
  revalidatePath("/admin/distribution/failed");
  revalidatePath("/admin/distribution/takedowns");
  revalidatePath("/admin/distribution/migration");
  revalidatePath("/admin/releases");
}

export async function queueReleaseAction(
  releaseId: string,
  notes?: string
): Promise<ActionResult> {
  await RequireAdminPermission("admin:distribution");
  const res = await queueApprovedRelease(releaseId, notes);
  revalidateDist();
  return res;
}

export async function submitJobAction(
  jobId: string,
  idempotencyKey?: string
): Promise<ActionResult> {
  await RequireAdminPermission("admin:distribution");
  const key = idempotencyKey?.trim() || `submit:${jobId}`;
  const res = await submitQueuedRelease(jobId, key);
  revalidateDist();
  return res;
}

export async function syncJobAction(jobId: string): Promise<ActionResult> {
  await RequireAdminPermission("admin:distribution");
  const res = await syncReleaseStatus(jobId);
  revalidateDist();
  return res;
}

export async function retryJobAction(jobId: string): Promise<ActionResult> {
  await RequireAdminPermission("admin:distribution");
  const res = await retryFailedJob(jobId);
  revalidateDist();
  return res;
}

export async function takedownAction(
  releaseId: string,
  reason?: string
): Promise<ActionResult> {
  await RequireAdminPermission("admin:distribution");
  const res = await requestTakedownAction(releaseId, reason);
  revalidateDist();
  return res;
}

export async function reinstateAction(
  releaseId: string,
  reason?: string
): Promise<ActionResult> {
  await RequireAdminPermission("admin:distribution");
  const res = await reinstateReleaseAction(releaseId, reason);
  revalidateDist();
  return res;
}

export async function createMigrationAction(input: {
  ownerUserId: string;
  artistProfileId?: string;
  title?: string;
  sourceName?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:distribution");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_catalog_migration", {
    p_owner_user_id: input.ownerUserId,
    p_artist_profile_id: input.artistProfileId ?? null,
    p_label_profile_id: null,
    p_source_name: input.sourceName ?? "unconfigured",
    p_title: input.title ?? null,
    p_notes: null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDist();
  return { ok: true, data };
}

export async function discoverCatalogAction(source: "spotify" | "apple_music" | "other") {
  await RequireAdminPermission("admin:distribution");
  const result = await discoverExternalCatalog({ source });
  return result;
}

export async function getDefaultCatalogAvailabilityAction() {
  await RequireAdminPermission("admin:distribution");
  return defaultUnavailableCatalog();
}

export async function upsertMappingAction(input: {
  artistProfileId: string;
  dspName: string;
  externalArtistId?: string;
  externalArtistUri?: string;
  externalArtistUrl?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:distribution");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_artist_dsp_mapping", {
    p_artist_profile_id: input.artistProfileId,
    p_dsp_name: input.dspName,
    p_external_artist_id: input.externalArtistId ?? null,
    p_external_artist_uri: input.externalArtistUri ?? null,
    p_external_artist_url: input.externalArtistUrl ?? null,
    p_verified: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/distribution/mapping");
  return { ok: true, data };
}

export async function offerOldTakedownAction(migrationId: string): Promise<ActionResult> {
  await RequireAdminPermission("admin:distribution");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("offer_old_distributor_takedown", {
    p_migration_id: migrationId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/distribution/migration");
  return { ok: true, data };
}


export async function saveProviderWebhookSecretAction(
  secret: string
): Promise<ActionResult<{ configured: true }>> {
  await RequireAdminPermission("admin:distribution");
  try {
    await setProviderWebhookSigningSecret(secret);
    revalidateDist();
    return { ok: true, data: { configured: true } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save webhook signing secret.",
    };
  }
}

export async function rotateProviderWebhookSecretAction(): Promise<
  ActionResult<{ secret: string }>
> {
  await RequireAdminPermission("admin:distribution");
  try {
    const secret = await rotateProviderWebhookSigningSecret();
    revalidateDist();
    return { ok: true, data: { secret } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not rotate webhook signing secret.",
    };
  }
}

export async function ensureProviderWebhookSecretAction(): Promise<
  ActionResult<{ configured: boolean; created: boolean; secret: string | null; source: string }>
> {
  await RequireAdminPermission("admin:distribution");
  try {
    const state = await ensureProviderWebhookSigningSecret();
    revalidateDist();
    return {
      ok: true,
      data: {
        configured: state.configured,
        created: state.created,
        secret: state.revealSecret,
        source: state.source,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not initialize webhook signing.",
    };
  }
}

export async function testProviderWebhookAction(): Promise<
  ActionResult<{ eventId: string; matchedRelease: boolean; mappedStatus: string | null }>
> {
  await RequireAdminPermission("admin:distribution");

  try {
    const state = await ensureProviderWebhookSigningSecret();
    const secret = state.revealSecret ?? (await loadProviderWebhookSigningSecret());
    if (!secret) {
      return { ok: false, error: "Webhook signing secret is unavailable." };
    }

    const eventId = `nexo_test_${randomUUID()}`;
    const rawBody = JSON.stringify({
      event_id: eventId,
      event_type: "nexo.webhook.test",
      status: "test",
      source: "nexo_admin",
    });
    const signature = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    const response = await fetch(`${getSiteUrl()}/api/webhooks/provider`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-provider-signature": `sha256=${signature}`,
        "user-agent": "Nexo-Webhook-Self-Test/1.0",
      },
      body: rawBody,
      cache: "no-store",
    });

    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; matchedRelease?: boolean; mappedStatus?: string | null; error?: string }
      | null;

    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        error: body?.error || `Webhook self-test failed (HTTP ${response.status}).`,
      };
    }

    revalidatePath("/admin/distribution/webhooks");
    revalidatePath("/admin/distribution");

    return {
      ok: true,
      data: {
        eventId,
        matchedRelease: Boolean(body.matchedRelease),
        mappedStatus: body.mappedStatus ?? null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Webhook self-test failed.",
    };
  }
}
