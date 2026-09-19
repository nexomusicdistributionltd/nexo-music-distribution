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
import {
  normalizeProviderLanguage,
  normalizeProviderLicenseType,
  normalizeProviderMinuteSecond,
  normalizeProviderReleaseTime,
  normalizeProviderText,
  normalizeProviderTimeZone,
} from "@/lib/provider/metadata-normalization";
import { preflightReleaseForDistribution } from "@/lib/distribution/actions";
import { formatDeliveryCorrection } from "@/lib/distribution/delivery-diagnostics";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type ProviderLookupOption = { value: string; label: string };

function providerValidationIsInvalid(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const outer = payload as Record<string, unknown>;
  const data =
    outer.data && typeof outer.data === "object" && !Array.isArray(outer.data)
      ? (outer.data as Record<string, unknown>)
      : outer;
  return data.valid === false;
}

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
    const rawValue =
      r.value ??
      r.code ??
      r.slug ??
      r.id ??
      r.artist_id ??
      r.artistId ??
      r.artist_name ??
      r.artistName ??
      r.name ??
      r.label;
    const rawLabel =
      r.label ?? r.artist_name ?? r.artistName ?? r.name ?? rawValue;
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
    preferenceArtists: ProviderLookupOption[];
  }>
> {
  await requireArtistOrLabel();
  try {
    const { distributionReference } = await import("@/lib/provider/distribution-reference");
    const [
      genresResult,
      languagesResult,
      platformsResult,
      countriesResult,
      preferenceArtistsResult,
      labelPreferencesResult,
    ] = await Promise.allSettled([
      distributionReference.genres(),
      distributionReference.languages(),
      distributionReference.platforms(),
      distributionReference.countries(),
      distributionReference.artistPreferences(),
      distributionReference.labelPreference(),
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
        preferenceArtists: (() => {
          const artistOptions =
            preferenceArtistsResult.status === "fulfilled"
              ? normalizeProviderLookup(
                  preferenceArtistsResult.value,
                  ["artists", "preferences", "items", "data"]
                )
              : [];
          const labelArtistOptions =
            labelPreferencesResult.status === "fulfilled"
              ? normalizeProviderLookup(
                  labelPreferencesResult.value,
                  ["artists", "preferences", "items", "data"]
                )
              : [];
          const merged = new Map<string, ProviderLookupOption>();
          for (const option of [...artistOptions, ...labelArtistOptions]) {
            merged.set(option.value, option);
          }
          return [...merged.values()];
        })(),
      },
    };
  } catch {
    return {
      ok: true,
      data: {
        genres: [],
        languages: [],
        platforms: [],
        countries: [],
        preferenceArtists: [],
      },
    };
  }
}


function preferenceRecord(payload: unknown): Record<string, unknown> {
  const outer =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const data =
    outer.data && typeof outer.data === "object" && !Array.isArray(outer.data)
      ? (outer.data as Record<string, unknown>)
      : outer;
  const artist =
    data.artist && typeof data.artist === "object" && !Array.isArray(data.artist)
      ? (data.artist as Record<string, unknown>)
      : data;
  return artist;
}

function preferenceString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function preferenceStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (!item || typeof item !== "object") return "";
        const row = item as Record<string, unknown>;
        const raw = row.code ?? row.value ?? row.name ?? row.slug ?? row.id;
        return raw == null ? "" : String(raw).trim();
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => key);
  }
  return [];
}

export async function getDistributionPreferenceDefaults(
  providerArtistId?: string | null
): Promise<
  ActionResult<{
    artistName: string | null;
    primaryGenre: string | null;
    secondaryGenre: string | null;
    language: string | null;
    label: string | null;
    cLine: string | null;
    pLine: string | null;
    releaseTime: string | null;
    timeZone: string | null;
    stores: string[];
    territories: string[];
    additional: Record<string, boolean>;
  }>
> {
  const ctx = await requireArtistOrLabel();
  try {
    const { distributionReference } = await import("@/lib/provider/distribution-reference");
    const payload =
      ctx.roles.includes("label") && providerArtistId
        ? await distributionReference.labelArtistPreference(providerArtistId)
        : await distributionReference.artistPreference();
    const artist = preferenceRecord(payload);
    const deliveries =
      artist.deliveries && typeof artist.deliveries === "object" && !Array.isArray(artist.deliveries)
        ? (artist.deliveries as Record<string, unknown>)
        : {};

    return {
      ok: true,
      data: {
        artistName:
          preferenceString(artist.artistName) ??
          preferenceString(artist.artist_name) ??
          preferenceString(artist.name),
        primaryGenre:
          preferenceString(artist.primaryGenre) ?? preferenceString(artist.primary_genre),
        secondaryGenre:
          preferenceString(artist.secondaryGenre) ?? preferenceString(artist.secondary_genre),
        language: preferenceString(artist.language),
        label: preferenceString(artist.label),
        cLine: preferenceString(artist.cLine) ?? preferenceString(artist.c_line),
        pLine: preferenceString(artist.pLine) ?? preferenceString(artist.p_line),
        releaseTime:
          preferenceString(artist.releaseTime) ?? preferenceString(artist.release_time),
        timeZone: preferenceString(artist.timeZone) ?? preferenceString(artist.time_zone),
        stores: preferenceStringList(artist.stores),
        territories: preferenceStringList(artist.territories),
        additional: {
          youtube: deliveries.delivery_youtube === true || deliveries.youtube === true,
          facebook: deliveries.delivery_facebook === true || deliveries.facebook === true,
          soundcloud:
            deliveries.delivery_soundcloud === true || deliveries.soundcloud === true,
          soundExchange:
            deliveries.delivery_soundexchange === true ||
            deliveries.soundExchange === true,
          beatPort: deliveries.beatport === true || deliveries.beatPort === true,
          junoDownloads:
            deliveries.delivery_junodownload === true ||
            deliveries.junoDownloads === true,
          trackLibs:
            deliveries.delivery_tracklib === true || deliveries.trackLibs === true,
          hook: deliveries.delivery_hook === true || deliveries.hook === true,
          lyricfind:
            deliveries.delivery_lyricfind === true || deliveries.lyricfind === true,
          // EVEN requires a separately connected EVEN account upstream. Do not
          // auto-enable it from saved TooLost preferences unless Nexo gains a
          // documented connection-state/linking flow for that service.
          even: false,
        },
      },
    };
  } catch {
    return { ok: false, error: "Distribution preferences are unavailable right now." };
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
  let defaultLabelName: string | null = null;

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
    defaultLabelName = data?.label_name?.trim() || null;
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
      label_name: defaultLabelName,
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

    const normalized = { ...(ds as Record<string, unknown>) };
    const rawLicenseType =
      typeof normalized.licenseType === "string"
        ? normalized.licenseType.trim().toLowerCase().replace(/_/g, " ")
        : "";

    // Copyright is the provider default. Remove stale/legacy Creative Commons
    // metadata when the wizard explicitly saves Copyright, including the null
    // value produced by the UI for provider-default licensing.
    if (
      normalized.licenseType == null ||
      rawLicenseType === "" ||
      ["copyright", "(c)", "c", "©"].includes(rawLicenseType)
    ) {
      delete normalized.licenseType;
      delete normalized.licenseInfo;
    } else if (["creative commons", "creative-commons", "cc"].includes(rawLicenseType)) {
      normalized.licenseType = "cc";
    }

    safe.distribution_settings = normalized;
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
    iswc?: string | null;
    liner_note?: string | null;
    tiktok_start_time?: string | null;
    duration_ms?: number | null;
    explicit?: boolean;
    clean_version?: boolean;
    instrumental?: boolean;
    ai_assisted?: boolean;
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
      iswc: t.iswc?.trim() || null,
      liner_note: t.liner_note?.trim() || null,
      tiktok_start_time: t.tiktok_start_time?.trim() || null,
      duration_ms: t.duration_ms ?? null,
      explicit: t.explicit ?? false,
      clean_version: t.clean_version ?? false,
      instrumental: t.instrumental ?? false,
      ai_assisted: t.ai_assisted ?? false,
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
    .select("id, track_number, title, version, isrc, iswc, liner_note, tiktok_start_time, duration_ms, explicit, clean_version, instrumental, ai_assisted, language, lyrics, created_at, updated_at, release_id")
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
      ? assertAudioFile({ type: input.mimeType, size: input.sizeBytes, name: input.filename })
      : assertArtworkFile({ type: input.mimeType, size: input.sizeBytes, name: input.filename });
  if (fileCheck) return { ok: false, error: fileCheck };

  if (input.kind === "audio" && !input.trackId) {
    return {
      ok: false,
      error: "Audio must be linked to a saved track. Save the track and retry the FLAC upload.",
    };
  }

  const normalizedMimeType = input.kind === "audio" ? "audio/flac" : input.mimeType;
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

  if (input.kind === "audio" && input.trackId) {
    const { data: previousAudio } = await supabase
      .from("release_assets")
      .select("*")
      .eq("release_id", input.releaseId)
      .eq("kind", "audio")
      .eq("track_id", input.trackId);
    for (const asset of previousAudio ?? []) {
      await supabase.storage.from(asset.storage_bucket).remove([asset.storage_path]);
      await supabase.from("release_assets").delete().eq("id", asset.id);
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
        const meta = await extractAudioTechMeta(buf, normalizedMimeType);
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

  if (input.kind === "audio") {
    const audioIssue =
      duration_ms == null ||
      sample_rate_hz == null ||
      bit_depth == null ||
      channels == null
        ? "Nexo could not verify the FLAC technical metadata. Re-export the master and upload it again."
        : duration_ms < 5000
          ? "Nexo requires audio tracks to be at least 5 seconds long."
          : bit_depth < 16
            ? "Audio must be at least 16-bit."
            : sample_rate_hz < 44100
              ? "Audio sample rate must be at least 44.1 kHz."
              : channels !== 2
                ? "Audio must be stereo."
                : null;
    if (audioIssue) {
      await supabase.storage.from(bucket).remove([input.storagePath]);
      return { ok: false, error: audioIssue };
    }
  }

  if (input.kind === "artwork") {
    const acceptedArtworkSize =
      width != null &&
      height != null &&
      width === height &&
      width >= 3000 &&
      width <= 5000;
    if (!acceptedArtworkSize) {
      await supabase.storage.from(bucket).remove([input.storagePath]);
      return {
        ok: false,
        error:
          width != null && height != null
            ? `Artwork is ${width}×${height}px. Nexo requires square artwork between 3000×3000 and 5000×5000px.`
            : "Artwork dimensions could not be verified. Upload a valid JPG, PNG, or TIFF image.",
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
      mime_type: normalizedMimeType,
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

  const currentSettings =
    release.distribution_settings &&
    typeof release.distribution_settings === "object" &&
    !Array.isArray(release.distribution_settings)
      ? { ...(release.distribution_settings as Record<string, unknown>) }
      : {};

  const preorderEnabled = currentSettings.applePreorder === true;
  const preorderDate =
    typeof currentSettings.applePreorderDate === "string"
      ? currentSettings.applePreorderDate.trim()
      : "";
  if (preorderEnabled && !preorderDate) {
    currentSettings.applePreorder = false;
    delete currentSettings.applePreorderDate;
    const { error: normalizeError } = await supabase
      .from("releases")
      .update({ distribution_settings: currentSettings })
      .eq("id", releaseId)
      .eq("owner_user_id", ctx.userId);
    if (normalizeError) return { ok: false, error: normalizeError.message };
    release.distribution_settings = currentSettings;
  }

  const licenseType =
    typeof currentSettings.licenseType === "string"
      ? currentSettings.licenseType.trim().toLowerCase()
      : "";
  const licenseInfo =
    typeof currentSettings.licenseInfo === "string"
      ? currentSettings.licenseInfo.trim()
      : "";
  if (
    ["creative commons", "creative_commons", "creative-commons", "cc"].includes(
      licenseType
    ) &&
    !licenseInfo
  ) {
    return {
      ok: false,
      error:
        "Creative Commons requires a CC 3.0 license clause. Add it in Rights → License / clearance information, or choose Copyright before submitting to QC.",
    };
  }

  const rawLicenseType = normalizeProviderText(
    typeof currentSettings.licenseType === "string" ? currentSettings.licenseType : null
  )?.toLowerCase();
  const isDefaultCopyright =
    !rawLicenseType || ["copyright", "(c)", "c", "©"].includes(rawLicenseType);
  if (
    !isDefaultCopyright &&
    !normalizeProviderLicenseType(
      typeof currentSettings.licenseType === "string" ? currentSettings.licenseType : null
    )
  ) {
    return {
      ok: false,
      error:
        "License type is not supported by the distribution provider. Choose Copyright or Creative Commons before submitting.",
    };
  }

  if (release.language && !normalizeProviderLanguage(release.language)) {
    return {
      ok: false,
      error:
        "Release language is not supported by the distribution provider. Select a supported language before submitting.",
    };
  }

  const releaseTime =
    typeof currentSettings.releaseTime === "string" ? currentSettings.releaseTime : null;
  if (releaseTime && !normalizeProviderReleaseTime(releaseTime)) {
    return {
      ok: false,
      error: "Release time must use 24-hour HH:MM format before submitting.",
    };
  }

  const timeZone =
    typeof currentSettings.timeZone === "string" ? currentSettings.timeZone : null;
  if (timeZone && !normalizeProviderTimeZone(timeZone)) {
    return {
      ok: false,
      error: "Release time zone is invalid. Select a valid time zone before submitting.",
    };
  }

  const additional =
    currentSettings.additional &&
    typeof currentSettings.additional === "object" &&
    !Array.isArray(currentSettings.additional)
      ? (currentSettings.additional as Record<string, unknown>)
      : {};
  const usesExclusiveRightsDelivery =
    additional.youtube === true ||
    additional.facebook === true ||
    additional.soundcloud === true;
  if (usesExclusiveRightsDelivery && currentSettings.additionalRightsConfirmed !== true) {
    return {
      ok: false,
      error:
        "Confirm that you control 100% of the exclusive rights required for the selected content-identification / monetization services before submitting.",
    };
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

  for (const track of tracks ?? []) {
    if (track.language && !normalizeProviderLanguage(track.language)) {
      return {
        ok: false,
        error: `Track ${track.track_number} language is not supported by the distribution provider. Select a supported language before submitting.`,
      };
    }
    if (
      track.tiktok_start_time &&
      !normalizeProviderMinuteSecond(track.tiktok_start_time)
    ) {
      return {
        ok: false,
        error: `Track ${track.track_number} TikTok start time must use minute:second format, for example 0:08 or 9:40.`,
      };
    }
  }

  const providerState = await getProviderConnectionState();
  if (providerState.connected) {
    try {
      const { distributionReference } = await import("@/lib/provider/distribution-reference");
      if (release.upc) {
        const checked = await distributionReference.validateUpc(release.upc);
        if (providerValidationIsInvalid(checked)) {
          return { ok: false, error: "The connected distribution provider rejected this UPC." };
        }
      }
      for (const track of tracks ?? []) {
        if (!track.isrc) continue;
        const checked = await distributionReference.validateIsrc(track.isrc);
        if (providerValidationIsInvalid(checked)) {
          return {
            ok: false,
            error: `The connected distribution provider rejected the ISRC on track ${track.track_number}.`,
          };
        }
      }
    } catch {
      return {
        ok: false,
        error:
          "Nexo could not validate the supplied UPC/ISRC codes with the connected distribution provider. Try again before submitting.",
      };
    }
  }

  const providerPreflight = await preflightReleaseForDistribution(releaseId);
  if (!providerPreflight.ok) {
    return {
      ok: false,
      error:
        `Distribution validation must pass before QC submission.\n\n${formatDeliveryCorrection(providerPreflight.error)}`,
    };
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
      iswc: t.iswc,
      liner_note: t.liner_note,
      tiktok_start_time: t.tiktok_start_time,
      duration_ms: t.duration_ms,
      explicit: t.explicit,
      clean_version: t.clean_version,
      instrumental: t.instrumental,
      ai_assisted: t.ai_assisted,
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
