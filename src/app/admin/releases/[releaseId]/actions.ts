"use server";

import { revalidatePath } from "next/cache";
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

  const changedFields = Object.keys(safe);
  if (!changedFields.length) return { ok: false, error: "No valid metadata changes supplied." };

  if (existing.provider_release_id) {
    const unsafeUpstream = changedFields.filter((field) => !PROVIDER_PATCHABLE_FIELDS.has(field));
    if (unsafeUpstream.length) {
      return {
        ok: false,
        error:
          `This release is already linked to TooLost. These fields cannot be safely changed after provider creation: ${unsafeUpstream.join(", ")}.`,
      };
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("releases")
    .update(safe)
    .eq("id", releaseId)
    .select("*")
    .single();
  if (updateError) return { ok: false, error: updateError.message };

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "release_update",
      p_entity_type: "release",
      p_entity_id: releaseId,
      p_metadata: {
        source: "admin_release_metadata",
        status,
        fields: changedFields,
      },
    });
  } catch {
    // Metadata update remains authoritative even if audit transport is temporarily unavailable.
  }

  let providerSynced = false;
  let providerWarning: string | undefined;

  if (existing.provider_release_id) {
    const state = await getProviderConnectionState();
    if (!state.connected) {
      providerWarning =
        "Nexo metadata was saved, but TooLost is not connected so the upstream release was not updated.";
    } else {
      try {
        await getProvider().updateRelease(existing.provider_release_id, {
          title: typeof safe.title === "string" ? safe.title : undefined,
          labelName:
            typeof safe.label_name === "string" || safe.label_name === null
              ? (safe.label_name as string | null)
              : undefined,
          genre:
            typeof safe.genre === "string" || safe.genre === null
              ? (safe.genre as string | null)
              : undefined,
          subgenre:
            typeof safe.subgenre === "string" || safe.subgenre === null
              ? (safe.subgenre as string | null)
              : undefined,
          language:
            typeof safe.language === "string" || safe.language === null
              ? (safe.language as string | null)
              : undefined,
          releaseDate:
            typeof safe.release_date === "string" || safe.release_date === null
              ? (safe.release_date as string | null)
              : undefined,
          originalReleaseDate:
            typeof safe.original_release_date === "string" || safe.original_release_date === null
              ? (safe.original_release_date as string | null)
              : undefined,
          copyrightYear:
            typeof safe.copyright_year === "number" || safe.copyright_year === null
              ? (safe.copyright_year as number | null)
              : undefined,
          copyrightLine:
            typeof safe.copyright_line === "string" || safe.copyright_line === null
              ? (safe.copyright_line as string | null)
              : undefined,
          phonogramLine:
            typeof safe.phonogram_line === "string" || safe.phonogram_line === null
              ? (safe.phonogram_line as string | null)
              : undefined,
          upc:
            typeof safe.upc === "string" || safe.upc === null
              ? (safe.upc as string | null)
              : undefined,
        });
        providerSynced = true;
      } catch (error) {
        providerWarning = toProviderErrorPayload(error).message;
      }
    }
  }

  revalidateRelease(releaseId);
  return {
    ok: true,
    data: {
      release: updated as ReleaseRow,
      providerSynced,
      ...(providerWarning ? { providerWarning } : {}),
    },
  };
}

export async function postApprovalReviewAction(input: {
  releaseId: string;
  decision: "request_changes" | "reject";
  reason: string;
}): Promise<AdminReleaseActionResult<unknown>> {
  await RequireAdminPermission("admin:qc");
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "Artist-visible reason is required." };

  const supabase = await createClient();
  const { data: release, error: readError } = await supabase
    .from("releases")
    .select("id,status")
    .eq("id", input.releaseId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!release) return { ok: false, error: "Release not found." };
  if (release.status !== "approved") {
    return {
      ok: false,
      error: "Post-approval review is available only while the release is approved and not yet queued for delivery.",
    };
  }

  const target = input.decision === "reject" ? "rejected" : "changes_requested";
  const { data, error } = await supabase.rpc("transition_release_status", {
    p_release_id: input.releaseId,
    p_new_status: target,
    p_reason: reason,
    p_metadata: {
      source: "admin_post_approval_review",
      decision: input.decision,
    },
  });
  if (error) return { ok: false, error: error.message };

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "release_status_change",
      p_entity_type: "release",
      p_entity_id: input.releaseId,
      p_metadata: {
        source: "admin_post_approval_review",
        from: "approved",
        to: target,
        reason,
      },
    });
  } catch {
    // transition_release_status already writes status history.
  }

  try {
    const { drainQueuedOutbox } = await import("@/lib/email/hooks");
    await drainQueuedOutbox(10);
  } catch {
    // State change is authoritative even if SMTP is temporarily unavailable.
  }

  revalidateRelease(input.releaseId);
  return { ok: true, data };
}
