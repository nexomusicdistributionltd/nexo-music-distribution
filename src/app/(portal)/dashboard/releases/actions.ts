"use server";

import { revalidatePath } from "next/cache";
import {
  RequireVerifiedPortal,
  assertCanMutateCatalog,
  assertCanSubmitRelease,
} from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  canDuplicate,
  canRequestTakedown,
  canSubmit,
  canTransition,
  isEditableStatus,
} from "@/lib/releases/status";
import { pickReleaseUpdateFields } from "@/lib/releases/safe-update";
import { applyUpcPreserveGuard, preserveExistingIsrc } from "@/lib/releases/identifiers";
import {
  extractArtworkTechMeta,
  extractAudioTechMeta,
} from "@/lib/releases/tech-meta";
import { validateReleaseForSubmit } from "@/lib/releases/validation";
import type {
  ContributorRole,
  ReleaseRow,
  ReleaseStatus,
  ReleaseTrackRow,
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
import { RATE_LIMITS, checkRateLimit } from "@/lib/security/rate-limit";
import { getProviderConnectionState } from "@/lib/provider";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type ProviderLookupOption = { value: string; label: string };

function normalizeProviderLookup(payload: unknown, keys: string[]): ProviderLookupOption[] {
  const outer =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const data =
    outer.data && typeof outer.data === "object" && !Array.isArray(outer.data)
      ? (outer.data as Record<string, unknown>)
      : outer;
  let rows: unknown[] = [];
  for (const key of keys) {
    if (Array.isArray(data[key])) {
      rows = data[key] as unknown[];
      break;
    }
  }
  if (!rows.length && Array.isArray(outer.data)) rows = outer.data as unknown[];

  const seen = new Set<string>();
  const options: ProviderLookupOption[] = [];
  for (const row of rows) {
    if (typeof row === "string") {
      const value = row.trim();
      if (value && !seen.has(value.toLowerCase())) {
        seen.add(value.toLowerCase());
        options.push({ value, label: value });
      }
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const rawValue = r.value ?? r.code ?? r.slug ?? r.id ?? r.name ?? r.label;
    const rawLabel = r.label ?? r.name ?? rawValue;
    if (rawValue == null || rawLabel == null) continue;
    const value = String(rawValue).trim();
    const label = String(rawLabel).trim();
    if (!value || !label || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    options.push({ value, label });
  }
  return options;
}

export async function getDistributionMetadataLookups(): Promise<
  ActionResult<{
    genres: ProviderLookupOption[];
    languages: ProviderLookupOption[];
    platforms: ProviderLookupOption[];
    countries: ProviderLookupOption[];
  }>
> {
  await requireArtistOrLabel();
  try {
    const { distributionReference } = await import("@/lib/provider/distribution-reference");
    const [genresResult, languagesResult, platformsResult, countriesResult] =
      await Promise.allSettled([
        distributionReference.genres(),
        distributionReference.languages(),
        distributionReference.platforms(),
        distributionReference.countries(),
      ]);
    return {
      ok: true,
      data: {
        genres:
          genresResult.status === "fulfilled"
            ? normalizeProviderLookup(genresResult.value, ["genres", "items", "data"])
            : [],
        languages:
          languagesResult.status === "fulfilled"
            ? normalizeProviderLookup(languagesResult.value, ["languages", "items", "data"])
            : [],
        platforms:
          platformsResult.status === "fulfilled"
            ? normalizeProviderLookup(platformsResult.value, ["platforms", "items", "data"])
            : [],
        countries:
          countriesResult.status === "fulfilled"
            ? normalizeProviderLookup(countriesResult.value, ["countries", "items", "data"])
            : [],
      },
    };
  } catch {
    return { ok: true, data: { genres: [], languages: [], platforms: [], countries: [] } };
  }
}

async function requireArtistOrLabel() {
  return RequireVerifiedPortal();
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
  /** Required for Label users — must be on their roster. Ignored for Artist users. */
  artist_profile_id?: string | null;
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

  const isArtist = ctx.roles.includes("artist");
  const isLabel = ctx.roles.includes("label");

  if (isArtist && isLabel) {
    return { ok: false, error: "Mixed artist/label roles are not allowed." };
  }

  if (isArtist) {
    const { data } = await supabase
      .from("artist_profiles")
      .select("id, artist_name, stage_name")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    artistProfileId = data?.id ?? null;
    primaryArtistName = data?.artist_name || data?.stage_name || primaryArtistName;
  }

  if (isLabel) {
    const { data } = await supabase
      .from("label_profiles")
      .select("id, label_name")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    labelProfileId = data?.id ?? null;
    if (!labelProfileId) return { ok: false, error: "Label profile not found." };

    const rosterArtistId = input.artist_profile_id?.trim() || null;
    if (!rosterArtistId) {
      return { ok: false, error: "Select a roster artist before creating a release." };
    }

    const { data: link } = await supabase
      .from("label_roster_artists")
      .select("artist_profile_id")
      .eq("label_profile_id", labelProfileId)
      .eq("artist_profile_id", rosterArtistId)
      .maybeSingle();
    if (!link) return { ok: false, error: "Selected artist is not on your roster." };

    const { data: ap } = await supabase
      .from("artist_profiles")
      .select("id, artist_name, stage_name")
      .eq("id", rosterArtistId)
      .maybeSingle();
    if (!ap) return { ok: false, error: "Roster artist not found." };

    artistProfileId = ap.id;
    primaryArtistName = ap.artist_name || ap.stage_name || primaryArtistName;
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
      },
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  try {
    await supabase.from("release_deals").insert({
      release_id: data.id,
      territories: ["WW"],
      use_types: ["OnDemandStream", "PermanentDownload"],
      commercial_model_types: ["SubscriptionModel", "PayAsYouGoModel"],
      is_default: true,
    });
  } catch {
    /* ignore */
  }

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "release_create",
      p_entity_type: "release",
      p_entity_id: data.id,
      p_metadata: {
        release_type: input.release_type,
        artist_profile_id: artistProfileId,
        label_profile_id: labelProfileId,
      },
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

  let safe = pickReleaseUpdateFields(patch as Record<string, unknown>);
  // Never overwrite existing UPC
  safe = applyUpcPreserveGuard(safe, existing.upc as string | null);

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
): Promise<ActionResult<{ count: number; tracks: ReleaseTrackRow[] }>> {
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

  const { data: current } = await supabase
    .from("release_tracks")
    .select("id, isrc")
    .eq("release_id", releaseId);
  const existingById = new Map((current ?? []).map((t) => [t.id, t.isrc as string | null]));

  for (const t of tracks) {
    const existingIsrc = t.id ? existingById.get(t.id) : null;
    const preserved = preserveExistingIsrc(existingIsrc, t.isrc);
    if (preserved) {
      const code = String(preserved).trim().toUpperCase();
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

  const { data: persisted } = await supabase
    .from("release_tracks")
    .select("id, track_number, title, version, isrc, duration_ms, explicit, language, lyrics, created_at, updated_at, release_id")
    .eq("release_id", releaseId)
    .order("track_number", { ascending: true });

  revalidateReleasePaths(releaseId);
  return {
    ok: true,
    data: { count: tracks.length, tracks: (persisted ?? []) as ReleaseTrackRow[] },
  };
}

export async function replaceContributors(
  releaseId: string,
  contributors: Array<{
    name: string;
    role: ContributorRole;
    track_id?: string | null;
    /** Optional share metadata only — NOT a DDEX DisplayArtist %. */
    share_percent?: number | null;
    ipi_cae?: string | null;
    isni?: string | null;
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
        // share_percent is optional ownership metadata only — NOT DisplayArtist %
        share_percent: c.share_percent ?? null,
        ipi_cae: c.ipi_cae?.trim() || null,
        isni: c.isni?.trim() || null,
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

  let width = input.width ?? null;
  let height = input.height ?? null;
  let codec: string | null = null;
  let container: string | null = null;
  let sample_rate_hz: number | null = null;
  let bit_depth: number | null = null;
  let channels: number | null = null;
  let duration_ms: number | null = null;
  let checksum: string | null = null;
  let hash_algorithm: string | null = null;

  try {
    const { data: blob, error: dlErr } = await supabase.storage
      .from(bucket)
      .download(input.storagePath);
    if (!dlErr && blob) {
      const ab = await blob.arrayBuffer();
      const buf = Buffer.from(ab);
      if (input.kind === "audio") {
        const meta = await extractAudioTechMeta(buf, input.mimeType);
        codec = meta.codec;
        container = meta.container;
        sample_rate_hz = meta.sample_rate_hz;
        bit_depth = meta.bit_depth;
        channels = meta.channels;
        duration_ms = meta.duration_ms;
        checksum = meta.checksum;
        hash_algorithm = meta.hash_algorithm;
      } else {
        const meta = extractArtworkTechMeta(buf);
        width = meta.width ?? width;
        height = meta.height ?? height;
        checksum = meta.checksum;
        hash_algorithm = meta.hash_algorithm;
      }
    }
  } catch {
    // leave nulls — readiness will surface missing tech meta
  }

  if (input.kind === "artwork") {
    const acceptedArtworkSize =
      width != null &&
      height != null &&
      width === height &&
      [1400, 3000, 4000].includes(width);
    if (!acceptedArtworkSize) {
      await supabase.storage.from(bucket).remove([input.storagePath]);
      return {
        ok: false,
        error:
          width != null && height != null
            ? `Artwork is ${width}×${height}px. Use exactly 1400×1400, 3000×3000, or 4000×4000px.`
            : "Artwork dimensions could not be verified. Upload a valid JPEG, PNG, or WebP image.",
      };
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
      width,
      height,
      codec,
      container,
      sample_rate_hz,
      bit_depth,
      channels,
      duration_ms,
      checksum,
      hash_algorithm,
      uploaded_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  if (input.kind === "audio" && input.trackId && duration_ms != null) {
    await supabase
      .from("release_tracks")
      .update({ duration_ms })
      .eq("id", input.trackId)
      .eq("release_id", input.releaseId);
  }

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
  const rlUp = checkRateLimit({
    key: `release:upload:${ctx.userId}`,
    ...RATE_LIMITS.assetUpload,
  });
  if (!rlUp.ok) return { ok: false, error: "Too many uploads. Please try again later." };

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
  const rl = checkRateLimit({
    key: `release:submit:${ctx.userId}`,
    ...RATE_LIMITS.releaseSubmit,
  });
  if (!rl.ok) return { ok: false, error: "Too many submit attempts. Please try again later." };

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
    const { snapshotReleaseDspTargets } = await import("@/lib/dsp/snapshot-targets");
    await snapshotReleaseDspTargets(
      supabase,
      releaseId,
      (release as { artist_profile_id?: string | null }).artist_profile_id
    );
  } catch {
    /* targeting snapshot is best-effort */
  }

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

  try {
    const { drainQueuedOutbox } = await import("@/lib/email/hooks");
    void drainQueuedOutbox(5);
  } catch {
    /* submit does not depend on SMTP */
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

  await getProviderConnectionState();

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
  const ctx = await requireArtistOrLabel();
  const supabase = await createClient();
  const { data: release } = await supabase
    .from("releases")
    .select("id,status")
    .eq("id", releaseId)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!release) return { ok: false, error: "Release not found." };
  return {
    ok: true,
    data: {
      message:
        release.status === "draft" || release.status === "changes_requested"
          ? "Complete the release and submit it to Nexo QC. Distribution delivery is handled after approval."
          : "This release is already in the Nexo QC/distribution workflow. Delivery is handled by Nexo after approval.",
    },
  };
}
