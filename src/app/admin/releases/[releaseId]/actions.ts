"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { pickReleaseUpdateFields } from "@/lib/releases/safe-update";
import type { ReleaseRow, ReleaseStatus, ReleaseType } from "@/lib/releases/types";
import {
  getProvider,
  getProviderConnectionState,
  toProviderErrorPayload,
} from "@/lib/provider";

export type AdminReleaseActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type AdminReleaseMetadataPatch = Partial<{
  title: string;
  version: string | null;
  primary_artist_name: string;
  genre: string | null;
  subgenre: string | null;
  language: string | null;
  release_date: string | null;
  original_release_date: string | null;
  label_name: string | null;
  copyright_year: number | null;
  copyright_line: string | null;
  phonogram_line: string | null;
  upc: string | null;
  explicit: boolean;
  description: string | null;
  territories: string[];
  release_type: ReleaseType;
}>;

const ADMIN_METADATA_EDITABLE = new Set<ReleaseStatus>([
  "draft",
  "submitted",
  "in_qc",
  "changes_requested",
  "approved",
  "rejected",
  "failed",
]);

const PROVIDER_PATCHABLE_FIELDS = new Set([
  "title",
  "version",
  "label_name",
  "genre",
  "subgenre",
  "language",
  "release_date",
  "original_release_date",
  "copyright_year",
  "copyright_line",
  "phonogram_line",
  "upc",
]);

function revalidateRelease(releaseId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/releases");
  revalidatePath(`/admin/releases/${releaseId}`);
  revalidatePath("/admin/qc");
  revalidatePath("/admin/distribution");
  revalidatePath("/admin/distribution/queue");
  revalidatePath("/admin/distribution/delivery");
}

function cleanNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function releaseValueEqual(field: string, left: unknown, right: unknown): boolean {
  if (field === "territories") {
    const normalize = (value: unknown) =>
      Array.isArray(value)
        ? [...value].map((item) => String(item).trim().toUpperCase()).filter(Boolean).sort()
        : [];
    return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
  }
  return (left ?? null) === (right ?? null);
}

function providerMetadataPatch(input: Record<string, unknown>) {
  return {
    title: typeof input.title === "string" ? input.title : undefined,
    version:
      typeof input.version === "string" || input.version === null
        ? (input.version as string | null)
        : undefined,
    labelName:
      typeof input.label_name === "string" || input.label_name === null
        ? (input.label_name as string | null)
        : undefined,
    genre:
      typeof input.genre === "string" || input.genre === null
        ? (input.genre as string | null)
        : undefined,
    subgenre:
      typeof input.subgenre === "string" || input.subgenre === null
        ? (input.subgenre as string | null)
        : undefined,
    language:
      typeof input.language === "string" || input.language === null
        ? (input.language as string | null)
        : undefined,
    releaseDate:
      typeof input.release_date === "string" || input.release_date === null
        ? (input.release_date as string | null)
        : undefined,
    originalReleaseDate:
      typeof input.original_release_date === "string" || input.original_release_date === null
        ? (input.original_release_date as string | null)
        : undefined,
    copyrightYear:
      typeof input.copyright_year === "number" || input.copyright_year === null
        ? (input.copyright_year as number | null)
        : undefined,
    copyrightLine:
      typeof input.copyright_line === "string" || input.copyright_line === null
        ? (input.copyright_line as string | null)
        : undefined,
    phonogramLine:
      typeof input.phonogram_line === "string" || input.phonogram_line === null
        ? (input.phonogram_line as string | null)
        : undefined,
    upc:
      typeof input.upc === "string" || input.upc === null
        ? (input.upc as string | null)
        : undefined,
  };
}

export async function updateAdminReleaseMetadataAction(
  releaseId: string,
  patch: AdminReleaseMetadataPatch
): Promise<
  AdminReleaseActionResult<{
    release: ReleaseRow;
    providerSynced: boolean;
    providerWarning?: string;
  }>
> {
  await RequireAdminPermission("admin:releases");
  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!existing) return { ok: false, error: "Release not found." };

  const status = existing.status as ReleaseStatus;
  if (!ADMIN_METADATA_EDITABLE.has(status)) {
    return {
      ok: false,
      error:
        "This release is already in an active delivery/live state. Change provider delivery state before editing metadata.",
    };
  }

  const safe = pickReleaseUpdateFields(patch as Record<string, unknown>);
  delete safe.distribution_settings;

  for (const key of [
    "version",
    "genre",
    "subgenre",
    "language",
    "release_date",
    "original_release_date",
    "label_name",
    "copyright_line",
    "phonogram_line",
    "upc",
    "description",
  ]) {
    if (Object.prototype.hasOwnProperty.call(safe, key)) {
      safe[key] = cleanNullableString(safe[key]);
    }
  }

  if (typeof safe.title === "string") {
    safe.title = safe.title.trim();
    if (!safe.title) return { ok: false, error: "Release title is required." };
  }
  if (typeof safe.primary_artist_name === "string") {
    safe.primary_artist_name = safe.primary_artist_name.trim();
    if (!safe.primary_artist_name) {
      return { ok: false, error: "Primary artist name is required." };
    }
  }

  if (typeof safe.upc === "string" && !/^[0-9]{12,14}$/.test(safe.upc)) {
    return { ok: false, error: "UPC must be 12–14 digits when provided." };
  }

  if (safe.copyright_year !== undefined && safe.copyright_year !== null) {
    const year = Number(safe.copyright_year);
    const maxYear = new Date().getUTCFullYear() + 1;
    if (!Number.isInteger(year) || year < 1900 || year > maxYear) {
      return { ok: false, error: `Copyright year must be between 1900 and ${maxYear}.` };
    }
    safe.copyright_year = year;
  }

  if (safe.territories !== undefined) {
    if (!Array.isArray(safe.territories)) {
      return { ok: false, error: "Territories must be a list." };
    }
    safe.territories = Array.from(
      new Set(
        safe.territories
          .map((territory) => String(territory).trim().toUpperCase())
          .filter(Boolean)
      )
    );
    if ((safe.territories as string[]).length === 0) {
      return { ok: false, error: "At least one territory is required." };
    }
  }

  const updates = Object.fromEntries(
    Object.entries(safe).filter(
      ([field, value]) => !releaseValueEqual(field, value, (existing as Record<string, unknown>)[field])
    )
  ) as Record<string, unknown>;

  const changedFields = Object.keys(updates);
  if (!changedFields.length) return { ok: false, error: "No metadata changes detected." };

  let providerPatch: ReturnType<typeof providerMetadataPatch> | null = null;
  if (existing.provider_release_id) {
    const unsafeUpstream = changedFields.filter((field) => !PROVIDER_PATCHABLE_FIELDS.has(field));
    if (unsafeUpstream.length) {
      return {
        ok: false,
        error:
          `This release is already linked to TooLost. These fields cannot be safely changed after provider creation: ${unsafeUpstream.join(", ")}.`,
      };
    }

    const unsupportedClears = changedFields.filter((field) => updates[field] === null);
    if (unsupportedClears.length) {
      return {
        ok: false,
        error:
          `TooLost's current metadata PATCH does not document clearing these linked fields: ${unsupportedClears.join(", ")}. Enter a replacement value instead.`,
      };
    }

    const state = await getProviderConnectionState();
    if (!state.connected) {
      return {
        ok: false,
        error:
          "TooLost is not connected. Reconnect the provider before changing metadata on a release that already exists upstream.",
      };
    }
    providerPatch = providerMetadataPatch(updates);
  }

  const { data: updated, error: updateError } = await supabase
    .from("releases")
    .update(updates)
    .eq("id", releaseId)
    .select("*")
    .single();
  if (updateError) return { ok: false, error: updateError.message };

  let providerSynced = false;

  if (existing.provider_release_id && providerPatch) {
    try {
      await getProvider().updateRelease(existing.provider_release_id, providerPatch);
      providerSynced = true;
    } catch (error) {
      const rollback = Object.fromEntries(
        changedFields.map((field) => [field, (existing as Record<string, unknown>)[field] ?? null])
      );
      const { error: rollbackError } = await supabase
        .from("releases")
        .update(rollback)
        .eq("id", releaseId);

      revalidateRelease(releaseId);
      const providerError = toProviderErrorPayload(error).message;
      return {
        ok: false,
        error: rollbackError
          ? `TooLost rejected the update and Nexo could not automatically restore the previous metadata. Reconcile this release before retrying. Provider error: ${providerError}`
          : `TooLost rejected the update, so Nexo restored the previous metadata. ${providerError}`,
      };
    }
  }

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "release_update",
      p_entity_type: "release",
      p_entity_id: releaseId,
      p_metadata: {
        source: "admin_release_metadata",
        status,
        fields: changedFields,
        provider_synced: providerSynced,
      },
    });
  } catch {
    // The metadata update is already authoritative; status history remains unchanged.
  }

  revalidateRelease(releaseId);
  return {
    ok: true,
    data: {
      release: updated as ReleaseRow,
      providerSynced,
    },
  };
}

export async function postApprovalReviewAction(input: {
  releaseId: string;
  reason: string;
}): Promise<AdminReleaseActionResult<unknown>> {
  // This action can cancel a queued distribution job, so Support/QC-only staff
  // must not be able to run it.
  await RequireAdminPermission("admin:distribution");

  const reason = input.reason.trim();
  if (reason.length < 4) {
    return { ok: false, error: "Enter a clear reason for the artist or label (at least 4 characters)." };
  }

  const supabase = await createClient();
  const { data: release, error: readError } = await supabase
    .from("releases")
    .select("id,status")
    .eq("id", input.releaseId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!release) return { ok: false, error: "Release not found." };

  if (!["approved", "scheduled", "failed", "changes_requested"].includes(release.status)) {
    return {
      ok: false,
      error:
        "This release is not in a state that can be returned for artist/label correction.",
    };
  }

  const { data, error } = await supabase.rpc("admin_reopen_release_for_corrections", {
    p_release_id: input.releaseId,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message };

  after(async () => {
    try {
      const { drainQueuedOutbox } = await import("@/lib/email/hooks");
      await drainQueuedOutbox(10);
    } catch {
      // The database state + in-app notification are authoritative even if email is delayed.
    }
  });

  revalidateRelease(input.releaseId);
  revalidatePath("/dashboard/releases");
  revalidatePath(`/dashboard/releases/${input.releaseId}`);
  revalidatePath("/dashboard/notifications");

  return { ok: true, data };
}
