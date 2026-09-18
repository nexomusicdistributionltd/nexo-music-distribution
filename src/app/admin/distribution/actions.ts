"use server";

import { createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { RequireAdminPermission, RequireSuperAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  queueApprovedRelease,
  submitQueuedRelease,
  syncReleaseStatus,
  requestTakedownAction,
  reinstateReleaseAction,
  retryFailedJob,
} from "@/lib/distribution/actions";
import { discoverTooLostCatalog } from "@/lib/migration/external-catalog";
import {
  ensureRuntimeProviderWebhookSecret,
  loadRuntimeProviderWebhookSecret,
  rotateRuntimeProviderWebhookSecret,
} from "@/lib/provider/webhook-secret";
import { verifyProviderWebhookSignature } from "@/lib/distribution/webhook";

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
  const sourceName = input.sourceName ?? "toolost";
  const availability =
    sourceName === "toolost"
      ? await discoverTooLostCatalog({ source: "other", page: 1, limit: 1 })
      : null;

  const { data, error } = await supabase.rpc("create_catalog_migration", {
    p_owner_user_id: input.ownerUserId,
    p_artist_profile_id: input.artistProfileId ?? null,
    p_label_profile_id: null,
    p_source_name: sourceName,
    p_title: input.title ?? null,
    p_notes: null,
  });
  if (error) return { ok: false, error: error.message };

  if (availability?.available && data?.id) {
    const { error: updateError } = await supabase
      .from("catalog_migrations")
      .update({
        source_connected: true,
        status: "draft",
        external_catalog_unavailable_reason: null,
        import_method: "external_api",
        workflow_step: "search",
        last_job_status: "source_ready",
        last_job_message: "Live TooLost catalog source connected.",
        last_job_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updateError) return { ok: false, error: updateError.message };
    data.source_connected = true;
    data.status = "draft";
    data.external_catalog_unavailable_reason = null;
  }

  revalidateDist();
  return { ok: true, data };
}

export async function discoverCatalogAction(
  source: "spotify" | "apple_music" | "other",
  migrationId?: string
) {
  await RequireAdminPermission("admin:distribution");
  const result = await discoverTooLostCatalog({ source, page: 1, limit: 100 });
  if (!result.available || !migrationId || result.items.length === 0) {
    return { ...result, importedIntoMigration: 0 };
  }

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("catalog_migration_items")
    .select("external_release_id")
    .eq("migration_id", migrationId);
  if (existingError) {
    return {
      available: false as const,
      source,
      reason: existingError.message,
      items: [] as const,
      importedIntoMigration: 0,
    };
  }

  const existingIds = new Set(
    (existing ?? [])
      .map((row) => String(row.external_release_id ?? "").trim())
      .filter(Boolean)
  );
  const freshItems = result.items.filter(
    (item) => !existingIds.has(item.externalReleaseId)
  );

  if (freshItems.length > 0) {
    const payload = freshItems.map((item) => {
      const rawTracks =
        item.raw && Array.isArray(item.raw.tracks) ? item.raw.tracks : undefined;
      return {
        title: item.title || null,
        artist_name: item.artistName || null,
        upc: item.upc ?? null,
        isrcs: item.isrcs ?? [],
        tracks: rawTracks,
        track_count: item.trackCount ?? null,
        external_release_id: item.externalReleaseId,
        selected: true,
      };
    });

    const { error: importError } = await supabase.rpc(
      "import_own_catalog_migration_items",
      {
        p_migration_id: migrationId,
        p_items: payload,
      }
    );
    if (importError) {
      return {
        available: false as const,
        source,
        reason: importError.message,
        items: [] as const,
        importedIntoMigration: 0,
      };
    }
  }

  await supabase
    .from("catalog_migrations")
    .update({
      source_name: "toolost",
      source_connected: true,
      external_catalog_unavailable_reason: null,
      import_method: "external_api",
    })
    .eq("id", migrationId);

  revalidateDist();
  return {
    ...result,
    importedIntoMigration: freshItems.length,
  };
}

export async function getDefaultCatalogAvailabilityAction() {
  await RequireAdminPermission("admin:distribution");
  return discoverTooLostCatalog({ source: "other", page: 1, limit: 1 });
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


export async function revealProviderWebhookSecretAction(): Promise<
  ActionResult<{ secret: string }>
> {
  await RequireSuperAdmin();
  const stored = await loadRuntimeProviderWebhookSecret();
  if (!stored) {
    return { ok: false, error: "Webhook signing secret is not provisioned." };
  }
  return { ok: true, data: { secret: stored.secret } };
}

export async function rotateProviderWebhookSecretAction(): Promise<
  ActionResult<{ secret: string }>
> {
  const ctx = await RequireSuperAdmin();
  try {
    const rotated = await rotateRuntimeProviderWebhookSecret(ctx.userId);
    revalidatePath("/admin/distribution/webhooks");
    return { ok: true, data: { secret: rotated.secret } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not rotate webhook secret.",
    };
  }
}

export async function testProviderWebhookSignatureAction(): Promise<
  ActionResult<{ message: string }>
> {
  const ctx = await RequireAdminPermission("admin:distribution");
  try {
    const runtime = await ensureRuntimeProviderWebhookSecret(ctx.userId);
    const rawBody = JSON.stringify({
      event_id: "nexo-signature-self-test",
      type: "nexo.webhook.signature_test",
    });
    const signature = createHmac("sha256", runtime.secret)
      .update(rawBody, "utf8")
      .digest("hex");
    const verified = verifyProviderWebhookSignature({
      rawBody,
      signatureHeader: `sha256=${signature}`,
      secretOverride: runtime.secret,
    });
    if (!verified.ok) {
      return { ok: false, error: verified.reason };
    }
    return {
      ok: true,
      data: {
        message:
          "Webhook HMAC verification passed. The Nexo endpoint is ready for signed provider events.",
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Webhook signature test failed.",
    };
  }
}
