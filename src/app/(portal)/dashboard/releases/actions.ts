"use server";

import { revalidatePath } from "next/cache";
import {
  RequireRole,
  assertCanMutateCatalog,
  assertCanSubmitRelease,
} from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getProviderConnectionState } from "@/lib/provider";
import {
  canDuplicate,
  canRequestTakedown,
  canSubmit,
  canTransition,
  isEditableStatus,
} from "@/lib/releases/status";
import { pickReleaseUpdateFields } from "@/lib/releases/safe-update";
import { validateReleaseForSubmit } from "@/lib/releases/validation";
import type {
  ContributorRole,
  ReleaseRow,
  ReleaseStatus,
  ReleaseType,
} from "@/lib/releases/types";
import {
  ARTWORK_BUCKET,
  AUDIO_BUCKET,
  assertArtworkFile,
  assertAudioFile,
  assertOwnedAssetPath,
  buildAssetPath,
} from "@/lib/storage/release-assets";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireArtistOrLabel() {
  return RequireRole(["artist", "label"]);
}

function revalidateReleasePaths(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/releases");
  revalidatePath("/dashboard/catalog");
  revalidatePath("/dashboard/notifications");
  if (id) revalidatePath(`/dashboard/releases/${id}`);
}

export async function createReleaseDraft(input: {
  release_type: ReleaseType;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireArtistOrLabel();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const supabase = await createClient();

  let artistProfileId: string | null = null;
  let labelProfileId: string | null = null;
  let primaryArtistName = ctx.profile?.display_name || ctx.profile?.full_name || "";

  if (ctx.roles.includes("artist")) {
    const { data } = await supabase
      .from("artist_profiles")
      .select("id, artist_name, stage_name")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    artistProfileId = data?.id ?? null;
    primaryArtistName = data?.artist_name || data?.stage_name || primaryArtistName;
  }
  if (ctx.roles.includes("label")) {
    const { data } = await supabase
      .from("label_profiles")
      .select("id, label_name")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    labelProfileId = data?.id ?? null;
  }

  const { data, error } = await supabase
    .from("releases")
    .insert({
      owner_user_id: ctx.userId,
      artist_profile_id: artistProfileId,
      label_profile_id: labelProfileId,
      release_type: input.release_type,
      title: "",
      primary_artist_name: primaryArtistName,
      status: "draft",
      territories: ["WW"],
      distribution_settings: {
        worldwide: true,
        provider: "not_connected",
      },
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "release_create",
      p_entity_type: "release",
      p_entity_id: data.id,
      p_metadata: { release_type: input.release_type },
    });
  } catch {
    /* ignore */
  }

  revalidateReleasePaths(data.id);
  return { ok: true, data: { id: data.id } };
}

export async function updateReleaseInfo(
  releaseId: string,
  patch: Partial<{
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
    distribution_settings: Record<string, unknown>;
    release_type: ReleaseType;
  }>
): Promise<ActionResult<ReleaseRow>> {
  const ctx = await requireArtistOrLabel();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const supabase = await createClient();

  const { data: existing, error: loadErr } = await supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (loadErr) return { ok: false, error: loadErr.message };
  if (!existing) return { ok: false, error: "Release not found." };
  if (!isEditableStatus(existing.status as ReleaseStatus)) {
    return { ok: false, error: `Release is locked (${existing.status}).` };
  }

  const safe = pickReleaseUpdateFields(patch as Record<string, unknown>);

  if (typeof safe.upc === "string" && safe.upc.trim() === "") safe.upc = null;
  if (typeof safe.upc === "string") {
    const upc = (safe.upc as string).trim();
    if (upc && !/^[0-9]{12,14}$/.test(upc)) {
      return { ok: false, error: "UPC must be 12–14 digits when provided." };
    }
    safe.upc = upc || null;
  }

  if (safe.distribution_settings !== undefined) {
    const ds = safe.distribution_settings;
    if (ds === null || typeof ds !== "object" || Array.isArray(ds)) {
      return { ok: false, error: "Invalid distribution settings." };
    }
  }

  if (Object.keys(safe).length === 0) {
    return { ok: false, error: "No valid fields to update." };
  }

  const { data, error } = await supabase
    .from("releases")
    .update(safe)
    .eq("id", releaseId)
    .eq("owner_user_id", ctx.userId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "release_update",
      p_entity_type: "release",
      p_entity_id: releaseId,
      p_metadata: { fields: Object.keys(safe) },
    });
  } catch {
    /* ignore */
  }

  revalidateReleasePaths(releaseId);
  return { ok: true, data: data as ReleaseRow };
}

export async function replaceTracks(
  releaseId: string,
  tracks: Array<{
    id?: string;
    track_number: number;
    title: string;
    version?: string | null;
    isrc?: string | null;
    duration_ms?: number | null;
    explicit?: boolean;
    language?: string | null;
    lyrics?: string | null;
  }>
): Promise<ActionResult<{ count: number }>> {
  const ctx = await requireArtistOrLabel();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("releases")
    .select("id, status, owner_user_id")
    .eq("id", releaseId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Release not found." };
  if (!isEditableStatus(existing.status as ReleaseStatus)) {
    return { ok: false, error: "Release is locked." };
  }

  for (const t of tracks) {
    if (t.isrc) {
      const code = t.isrc.trim().toUpperCase();
      if (!/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(code)) {
        return {
          ok: false,
          error: `Invalid ISRC on track ${t.track_number}. Do not fabricate codes.`,
        };
      }
      t.isrc = code;
    } else {
      t.isrc = null;
    }
  }

  const { data: current } = await supabase
    .from("release_tracks")
    .select("id")
    .eq("release_id", releaseId);
  const keepIds = new Set(tracks.map((t) => t.id).filter(Boolean) as string[]);
  const toDelete = (current ?? []).filter((t) => !keepIds.has(t.id)).map((t) => t.id);
  if (toDelete.length) {
    await supabase.from("release_tracks").delete().in("id", toDelete);
  }

  for (const t of tracks) {
    const row = {
      release_id: releaseId,
      track_number: t.track_number,
      title: t.title.trim(),
      version: t.version ?? null,
      isrc: t.isrc ?? null,
      duration_ms: t.duration_ms ?? null,
      explicit: t.explicit ?? false,
      language: t.language ?? null,
      lyrics: t.lyrics ?? null,
    };
    if (t.id) {
      const { error } = await supabase
        .from("release_tracks")
        .update(row)
        .eq("id", t.id)
        .eq("release_id", releaseId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("release_tracks").insert(row);
      if (error) return { ok: false, error: error.message };
    }
  }

  revalidateReleasePaths(releaseId);
  return { ok: true, data: { count: tracks.length } };
}

export async function replaceContributors(
  releaseId: string,
  contributors: Array<{
    name: string;
    role: ContributorRole;
    track_id?: string | null;
    share_percent?: number | null;
  }>
): Promise<ActionResult<{ count: number }>> {
  const ctx = await requireArtistOrLabel();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("releases")
    .select("id, status")
    .eq("id", releaseId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Release not found." };
  if (!isEditableStatus(existing.status as ReleaseStatus)) {
    return { ok: false, error: "Release is locked." };
  }

  await supabase.from("release_contributors").delete().eq("release_id", releaseId);

  if (contributors.length) {
    const { error } = await supabase.from("release_contributors").insert(
      contributors.map((c) => ({
        release_id: releaseId,
        name: c.name.trim(),
        role: c.role,
        track_id: c.track_id ?? null,
        share_percent: c.share_percent ?? null,
      }))
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidateReleasePaths(releaseId);
  return { ok: true, data: { count: contributors.length } };
}

export async function registerUploadedAsset(input: {
  releaseId: string;
  trackId?: string | null;
  kind: "audio" | "artwork";
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  replaceAssetId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireArtistOrLabel();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("releases")
    .select("id, status, owner_user_id")
    .eq("id", input.releaseId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Release not found." };
  if (!isEditableStatus(existing.status as ReleaseStatus)) {
    return { ok: false, error: "Release is locked." };
  }

  const fileCheck =
    input.kind === "audio"
      ? assertAudioFile({ type: input.mimeType, size: input.sizeBytes })
      : assertArtworkFile({ type: input.mimeType, size: input.sizeBytes });
  if (fileCheck) return { ok: false, error: fileCheck };

  const bucket = input.kind === "audio" ? AUDIO_BUCKET : ARTWORK_BUCKET;
  const pathErr = assertOwnedAssetPath(input.storagePath, ctx.userId, input.releaseId);
  if (pathErr) return { ok: false, error: pathErr };

  if (input.replaceAssetId) {
    const { data: old } = await supabase
      .from("release_assets")
      .select("*")
      .eq("id", input.replaceAssetId)
      .eq("release_id", input.releaseId)
      .maybeSingle();
    if (old) {
      await supabase.storage.from(old.storage_bucket).remove([old.storage_path]);
      await supabase.from("release_assets").delete().eq("id", old.id);
    }
  }

  if (input.kind === "artwork") {
    const { data: covers } = await supabase
      .from("release_assets")
      .select("*")
      .eq("release_id", input.releaseId)
      .eq("kind", "artwork");
    for (const cover of covers ?? []) {
      await supabase.storage.from(cover.storage_bucket).remove([cover.storage_path]);
      await supabase.from("release_assets").delete().eq("id", cover.id);
    }
  }

  const { data, error } = await supabase
    .from("release_assets")
    .insert({
      release_id: input.releaseId,
      track_id: input.trackId ?? null,
      kind: input.kind,
      storage_bucket: bucket,
      storage_path: input.storagePath,
      filename: input.filename,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      width: input.width ?? null,
      height: input.height ?? null,
      uploaded_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "asset_upload",
      p_entity_type: "release_asset",
      p_entity_id: data.id,
      p_metadata: { kind: input.kind, release_id: input.releaseId },
    });
  } catch {
    /* ignore */
  }

  revalidateReleasePaths(input.releaseId);
  return { ok: true, data: { id: data.id } };
}

export async function prepareAssetUpload(input: {
  releaseId: string;
  kind: "audio" | "artwork";
  filename: string;
}): Promise<ActionResult<{ bucket: string; path: string; id: string }>> {
  const ctx = await requireArtistOrLabel();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("releases")
    .select("id, status")
    .eq("id", input.releaseId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Release not found." };
  if (!isEditableStatus(existing.status as ReleaseStatus)) {
    return { ok: false, error: "Release is locked." };
  }

  const id = crypto.randomUUID();
  const path = buildAssetPath({
    userId: ctx.userId,
    releaseId: input.releaseId,
    kind: input.kind,
    filename: input.filename,
    id,
  });
  const bucket = input.kind === "audio" ? AUDIO_BUCKET : ARTWORK_BUCKET;
  return { ok: true, data: { bucket, path, id } };
}

export async function submitRelease(releaseId: string): Promise<ActionResult<ReleaseRow>> {
  const ctx = await requireArtistOrLabel();
  try {
    assertCanSubmitRelease(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const supabase = await createClient();

  const { data: release } = await supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!release) return { ok: false, error: "Release not found." };
  if (!canSubmit(release.status as ReleaseStatus)) {
    return { ok: false, error: `Cannot submit from status ${release.status}.` };
  }

  const [{ data: tracks }, { data: assets }, { data: contributors }] = await Promise.all([
    supabase.from("release_tracks").select("*").eq("release_id", releaseId),
    supabase.from("release_assets").select("*").eq("release_id", releaseId),
    supabase.from("release_contributors").select("*").eq("release_id", releaseId),
  ]);

  const issues = validateReleaseForSubmit({
    release: release as ReleaseRow,
    tracks: tracks ?? [],
    assets: assets ?? [],
    contributors: contributors ?? [],
  });
  if (issues.length) {
    return { ok: false, error: issues.map((i) => i.message).join(" ") };
  }

  const transitionCheck = canTransition({
    from: release.status as ReleaseStatus,
    to: "submitted",
    actor: "owner",
    providerConnected: Boolean(release.provider_connected),
    isOwner: true,
  });
  if (!transitionCheck.ok) {
    return { ok: false, error: transitionCheck.reason ?? "Transition denied." };
  }

  const { data, error } = await supabase.rpc("submit_release_to_qc", {
    p_release_id: releaseId,
    p_validation_snapshot: { issues: [], trackCount: tracks?.length ?? 0 },
    p_notes: null,
  });

  if (error) return { ok: false, error: error.message };

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "release_submit",
      p_entity_type: "release",
      p_entity_id: releaseId,
      p_metadata: {},
    });
  } catch {
    /* ignore */
  }

  revalidateReleasePaths(releaseId);
  return { ok: true, data: data as ReleaseRow };
}

export async function requestTakedown(
  releaseId: string,
  reason: string
): Promise<ActionResult<ReleaseRow>> {
  const ctx = await requireArtistOrLabel();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const supabase = await createClient();

  const { data: release } = await supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!release) return { ok: false, error: "Release not found." };
  if (!canRequestTakedown(release.status as ReleaseStatus)) {
    return { ok: false, error: "Takedown is not available for this status." };
  }

  void getProviderConnectionState();

  const { data, error } = await supabase.rpc("transition_release_status", {
    p_release_id: releaseId,
    p_new_status: "takedown_requested",
    p_reason: reason.trim() || "Takedown requested by owner",
    p_metadata: { source: "owner_request" },
  });
  if (error) return { ok: false, error: error.message };

  // Owner notification is created inside transition_release_status (SECURITY DEFINER).

  revalidateReleasePaths(releaseId);
  return { ok: true, data: data as ReleaseRow };
}

export async function duplicateRelease(
  releaseId: string
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireArtistOrLabel();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const supabase = await createClient();

  const { data: source } = await supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!source) return { ok: false, error: "Release not found." };
  if (!canDuplicate(source.status as ReleaseStatus)) {
    return { ok: false, error: "Cannot duplicate this release." };
  }

  const { data: created, error } = await supabase
    .from("releases")
    .insert({
      owner_user_id: ctx.userId,
      artist_profile_id: source.artist_profile_id,
      label_profile_id: source.label_profile_id,
      release_type: source.release_type,
      title: `${source.title || "Untitled"} (Copy)`,
      version: source.version,
      primary_artist_name: source.primary_artist_name,
      genre: source.genre,
      subgenre: source.subgenre,
      language: source.language,
      release_date: source.release_date,
      original_release_date: source.original_release_date,
      label_name: source.label_name,
      copyright_year: source.copyright_year,
      copyright_line: source.copyright_line,
      phonogram_line: source.phonogram_line,
      upc: null,
      explicit: source.explicit,
      description: source.description,
      territories: source.territories,
      distribution_settings: {
        ...(source.distribution_settings as object),
        provider: "not_connected",
      },
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const { data: tracks } = await supabase
    .from("release_tracks")
    .select("*")
    .eq("release_id", releaseId)
    .order("track_number");

  for (const t of tracks ?? []) {
    await supabase.from("release_tracks").insert({
      release_id: created.id,
      track_number: t.track_number,
      title: t.title,
      version: t.version,
      isrc: null,
      duration_ms: t.duration_ms,
      explicit: t.explicit,
      language: t.language,
      lyrics: t.lyrics,
    });
  }

  const { data: contributors } = await supabase
    .from("release_contributors")
    .select("*")
    .eq("release_id", releaseId);

  if (contributors?.length) {
    await supabase.from("release_contributors").insert(
      contributors.map((c) => ({
        release_id: created.id,
        track_id: null,
        name: c.name,
        role: c.role,
        share_percent: c.share_percent,
      }))
    );
  }

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "release_duplicate",
      p_entity_type: "release",
      p_entity_id: created.id,
      p_metadata: { source_id: releaseId },
    });
  } catch {
    /* ignore */
  }

  revalidateReleasePaths(created.id);
  return { ok: true, data: { id: created.id } };
}

export async function deleteDraftRelease(
  releaseId: string
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireArtistOrLabel();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("releases")
    .select("id, status")
    .eq("id", releaseId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Release not found." };
  if (existing.status !== "draft") {
    return { ok: false, error: "Only draft releases can be deleted." };
  }

  const { data: assets } = await supabase
    .from("release_assets")
    .select("storage_bucket, storage_path")
    .eq("release_id", releaseId);

  for (const a of assets ?? []) {
    await supabase.storage.from(a.storage_bucket).remove([a.storage_path]);
  }

  const { error } = await supabase.from("releases").delete().eq("id", releaseId);
  if (error) return { ok: false, error: error.message };

  revalidateReleasePaths();
  return { ok: true, data: { id: releaseId } };
}

export async function tryProviderSubmit(
  releaseId: string
): Promise<ActionResult<{ message: string }>> {
  void releaseId;
  await requireArtistOrLabel();
  const state = getProviderConnectionState();
  if (!state.connected) {
    return { ok: false, error: state.message };
  }
  return { ok: false, error: "Provider not connected." };
}
