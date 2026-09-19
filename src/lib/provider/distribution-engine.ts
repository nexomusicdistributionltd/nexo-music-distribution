import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import { loadDistributionAccessToken } from "./oauth/store";
import { readDistributionOAuthConfig } from "./oauth/config";
import type {
  DistributionProvider,
  ProviderCatalogQuery,
  ProviderDeliveryStatus,
  ProviderReleasePayload,
  ProviderStatusResult,
  ProviderWebhookEvent,
} from "./types";
import {
  ProviderDeliveryValidationError,
  ProviderUnavailableError,
} from "./errors";
import { normalizeProviderDeliveryPayload } from "@/lib/distribution/provider-delivery";
import {
  normalizeProviderDate,
  normalizeProviderLanguage,
  normalizeProviderLicenseType,
  normalizeProviderReleaseTime,
  normalizeProviderMinuteSecond,
  normalizeProviderText,
  normalizeProviderTimeZone,
  normalizeRightsText,
} from "./metadata-normalization";

type Json = Record<string, unknown>;

const INTERNAL_PROVIDER_KEY = "distribution_engine";
const PROVIDER_AUDIO_MIME = "audio/flac";

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = await loadDistributionAccessToken();
  if (!token) {
    throw new ProviderUnavailableError(
      "Distribution Engine authorization is unavailable. Reconnect it from the admin integration."
    );
  }

  const cfg = readDistributionOAuthConfig();
  const response = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const raw = await response.text();

    const flattenProviderError = (
      value: unknown,
      pathParts: string[] = [],
      depth = 0
    ): string[] => {
      if (depth > 5 || value == null) return [];
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const text = String(value).trim();
        if (!text) return [];
        return [pathParts.length ? `${pathParts.join(".")}: ${text}` : text];
      }
      if (Array.isArray(value)) {
        return value.flatMap((item) => flattenProviderError(item, pathParts, depth + 1));
      }
      if (typeof value !== "object") return [];

      const record = value as Record<string, unknown>;
      const explicitField =
        typeof record.field === "string"
          ? record.field
          : typeof record.path === "string"
            ? record.path
            : typeof record.attribute === "string"
              ? record.attribute
              : null;
      const explicitMessage =
        typeof record.message === "string"
          ? record.message
          : typeof record.detail === "string"
            ? record.detail
            : typeof record.reason === "string"
              ? record.reason
              : null;

      const lines: string[] = [];
      if (explicitMessage?.trim()) {
        lines.push(
          explicitField
            ? `${explicitField}: ${explicitMessage.trim()}`
            : explicitMessage.trim()
        );
      }

      for (const [key, nested] of Object.entries(record)) {
        if (["field", "path", "attribute", "message", "detail", "reason", "status", "code"].includes(key)) {
          continue;
        }
        const nextPath =
          ["errors", "error", "validation", "violations"].includes(key.toLowerCase())
            ? pathParts
            : [...pathParts, key];
        lines.push(...flattenProviderError(nested, nextPath, depth + 1));
      }
      return lines;
    };

    let detail = "";
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        const lines = [...new Set(flattenProviderError(parsed))]
          .filter((line) => line && !/^\d{3}$/.test(line))
          .slice(0, 8);
        detail = lines.join("; ").trim();
      } catch {
        detail = raw.trim();
      }
    }
    if (detail.length > 900) detail = `${detail.slice(0, 900)}…`;

    const stage =
      path.endsWith("/metadata")
        ? "release metadata"
        : path.endsWith("/delivery")
          ? "delivery settings"
          : path.includes("/tracks/upload-url")
            ? "track audio upload"
            : path.endsWith("/tracks")
              ? "track metadata"
              : path.endsWith("/submit")
                ? "final submission"
                : "provider request";

    const message = `Nexo delivery validation failed at ${stage} (HTTP ${response.status})${detail ? `: ${detail}` : "."}`;
    if ([400, 409, 422].includes(response.status)) {
      throw new ProviderDeliveryValidationError(message);
    }
    throw new ProviderUnavailableError(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function unwrapData(value: unknown): Json {
  const outer = object(value);
  return object(outer.data).id != null || Object.keys(object(outer.data)).length > 0
    ? object(outer.data)
    : outer;
}

function firstString(o: Json, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = o[key];
    if ((typeof value === "string" || typeof value === "number") && String(value)) {
      return String(value);
    }
  }
  return undefined;
}

function releaseId(value: unknown): string {
  const data = unwrapData(value);
  const id = firstString(data, ["id", "release_id", "releaseId"]);
  if (!id) {
    throw new ProviderUnavailableError(
      "Distribution Engine did not return a release identifier."
    );
  }
  return id;
}

function providerReleaseType(
  type: ProviderReleasePayload["type"]
): "Single" | "EP" | "Album" | "Compilation" {
  if (type === "ep") return "EP";
  if (type === "album") return "Album";
  if (type === "compilation") return "Compilation";
  return "Single";
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function compactObject(input: Json): Json {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function releaseParticipants(input: ProviderReleasePayload) {
  const participants =
    input.participants?.length
      ? input.participants
      : [
          {
            name: input.primaryArtistName,
            role: ["primary"],
            ...(input.primaryArtistProviderId
              ? { artistId: input.primaryArtistProviderId }
              : {}),
          },
        ];

  return participants
    .map((participant) => ({
      ...participant,
      name: normalizeProviderText(participant.name) ?? "",
      role: participant.role
        .map((role) => normalizeProviderText(role)?.toLowerCase())
        .filter((role): role is string => Boolean(role)),
    }))
    .filter((participant) => participant.name && participant.role.length > 0);
}

function additionalDeliverySettings(input: ProviderReleasePayload): Json {
  const additional = input.deliverySettings?.additional;
  const normalized =
    additional && typeof additional === "object" && !Array.isArray(additional)
      ? { ...(additional as Json) }
      : {};

  // TooLost treats EVEN as an account-linked delivery service. A saved delivery
  // preference can say EVEN=true even when the authorizing TooLost account has
  // no EVEN connection, which makes final /submit fail with HTTP 422. Nexo does
  // not currently expose a documented EVEN-account connection check, so never
  // auto-request it. Sending false also clears stale EVEN=true on an existing
  // provider draft before the final submit is retried.
  delete normalized.delivery_even;
  normalized.even = false;

  return normalized;
}

async function existingProviderDraft(releaseIdValue: string): Promise<string | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("provider_release_links")
    .select("provider_release_id")
    .eq("release_id", releaseIdValue)
    .eq("provider_name", INTERNAL_PROVIDER_KEY)
    .maybeSingle();

  return typeof data?.provider_release_id === "string" && data.provider_release_id
    ? data.provider_release_id
    : null;
}

async function rememberProviderDraft(
  nexoReleaseId: string,
  providerReleaseId: string,
  providerStatus: string
): Promise<void> {
  const db = createServiceClient();
  const { error } = await db.from("provider_release_links").upsert(
    {
      release_id: nexoReleaseId,
      provider_name: INTERNAL_PROVIDER_KEY,
      provider_release_id: providerReleaseId,
      provider_status: providerStatus,
      delivery_status: providerStatus,
      last_synced_at: new Date().toISOString(),
      metadata: { source: "distribution_engine_api" },
    },
    { onConflict: "release_id,provider_name" }
  );
  if (error) {
    throw new ProviderUnavailableError(
      "Distribution Engine draft was created, but Nexo could not persist the delivery link."
    );
  }
}

async function signedArtworkUrl(input: ProviderReleasePayload): Promise<string> {
  if (!input.artworkStorageBucket || !input.artworkStoragePath) {
    throw new ProviderDeliveryValidationError(
      "Cover artwork is required before this release can be delivered."
    );
  }

  const db = createServiceClient();
  const { data, error } = await db.storage
    .from(input.artworkStorageBucket)
    .createSignedUrl(input.artworkStoragePath, 60 * 60 * 24);

  if (error || !data?.signedUrl) {
    throw new ProviderUnavailableError(
      "Nexo could not prepare the private cover artwork for delivery."
    );
  }
  return data.signedUrl;
}

async function loadAudioBytes(track: ProviderReleasePayload["tracks"][number]): Promise<ArrayBuffer> {
  if (!track.audioStorageBucket || !track.audioStoragePath) {
    throw new ProviderDeliveryValidationError(
      `Track ${track.trackNumber} is missing its linked audio file.`
    );
  }

  if (track.audioMimeType !== PROVIDER_AUDIO_MIME) {
    throw new ProviderDeliveryValidationError(
      `Track ${track.trackNumber} must use lossless FLAC audio for Nexo delivery. Re-upload this track as FLAC before retrying.`
    );
  }

  const db = createServiceClient();
  const { data, error } = await db.storage
    .from(track.audioStorageBucket)
    .download(track.audioStoragePath);

  if (error || !data) {
    throw new ProviderUnavailableError(
      `Nexo could not read the audio file for track ${track.trackNumber}.`
    );
  }
  return data.arrayBuffer();
}

async function uploadTrackAudio(
  providerReleaseId: string,
  track: ProviderReleasePayload["tracks"][number]
): Promise<string> {
  const fileName = nonEmpty(track.audioFilename) ?? `track-${track.trackNumber}.flac`;
  const raw = await request(
    `/releases/${encodeURIComponent(providerReleaseId)}/tracks/upload-url`,
    {
      method: "POST",
      body: JSON.stringify({
        kind: "audio",
        fileName,
        contentType: PROVIDER_AUDIO_MIME,
      }),
    }
  );

  const data = unwrapData(raw);
  const uploadUrl = firstString(data, ["uploadUrl", "upload_url"]);
  const fileKey = firstString(data, ["fileKey", "file_key"]);
  const method = (firstString(data, ["method"]) ?? "PUT").toUpperCase();
  const providedHeaders = object(data.headers);

  if (!uploadUrl || !fileKey) {
    throw new ProviderUnavailableError(
      "Distribution Engine did not return a valid audio upload target."
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(uploadUrl);
  } catch {
    throw new ProviderUnavailableError(
      "Distribution Engine returned an invalid audio upload target."
    );
  }
  if (parsed.protocol !== "https:") {
    throw new ProviderUnavailableError(
      "Distribution Engine returned an insecure audio upload target."
    );
  }

  const audio = await loadAudioBytes(track);
  const headers = new Headers();
  for (const [key, value] of Object.entries(providedHeaders)) {
    if (typeof value === "string") headers.set(key, value);
  }
  if (!headers.has("content-type")) headers.set("content-type", PROVIDER_AUDIO_MIME);

  const uploaded = await fetch(uploadUrl, {
    method,
    headers,
    body: audio,
    cache: "no-store",
  });
  if (!uploaded.ok) {
    throw new ProviderUnavailableError(
      `Distribution Engine audio upload failed (HTTP ${uploaded.status}).`
    );
  }

  return fileKey;
}

async function assertProviderDraft(providerReleaseId: string): Promise<void> {
  const current = unwrapData(await request(`/releases/${encodeURIComponent(providerReleaseId)}`));
  if (firstString(current, ["status", "release_status"])?.toLowerCase() !== "draft") {
    throw new ProviderUnavailableError(
      "The linked TooLost release is no longer a draft. Sync its current status and contact distribution support for corrections; it cannot be overwritten through the draft API."
    );
  }
}

async function createOrResumeDraft(input: ProviderReleasePayload): Promise<string> {
  const remembered = await existingProviderDraft(input.releaseId);
  if (remembered) {
    await assertProviderDraft(remembered);
    return remembered;
  }

  const created = await request("/releases", {
    method: "POST",
    body: JSON.stringify({
      participants: releaseParticipants(input),
      title: input.title,
      type: providerReleaseType(input.type),
      ...(nonEmpty(input.labelName) ? { label: input.labelName } : {}),
    }),
  });

  const id = releaseId(created);
  await rememberProviderDraft(input.releaseId, id, "draft");
  return id;
}

async function prepareProviderRelease(
  providerReleaseId: string,
  input: ProviderReleasePayload
): Promise<void> {
  const coverUrl = await signedArtworkUrl(input);
  const normalizedLanguage = normalizeProviderLanguage(input.language);
  if (input.language && !normalizedLanguage) {
    throw new ProviderDeliveryValidationError(
      `Release language "${normalizeProviderText(input.language) ?? input.language}" is not a supported ISO language value.`
    );
  }
  const rawLicenseType = normalizeProviderText(input.licenseType)?.toLowerCase();
  const defaultCopyrightLicense = Boolean(
    rawLicenseType &&
      ["copyright", "(c)", "c", "©"].includes(rawLicenseType)
  );
  const normalizedLicenseType = normalizeProviderLicenseType(input.licenseType);
  if (input.licenseType && !defaultCopyrightLicense && !normalizedLicenseType) {
    throw new ProviderDeliveryValidationError(
      "Release license type is not supported. Choose Copyright or Creative Commons."
    );
  }
  if (
    normalizedLicenseType === "Creative Commons" &&
    !normalizeProviderText(input.licenseInfo)
  ) {
    throw new ProviderDeliveryValidationError(
      "Creative Commons requires a valid CC 3.0 license clause in license information."
    );
  }
  const normalizedTimeZone = normalizeProviderTimeZone(input.timeZone);
  if (input.timeZone && !normalizedTimeZone) {
    throw new ProviderDeliveryValidationError(
      `Release time zone "${normalizeProviderText(input.timeZone) ?? input.timeZone}" is invalid.`
    );
  }
  const normalizedReleaseTime = normalizeProviderReleaseTime(input.releaseTime);
  if (input.releaseTime && !normalizedReleaseTime) {
    throw new ProviderDeliveryValidationError(
      "Release time must use 24-hour HH:MM format."
    );
  }
  const preorderDate = normalizeProviderDate(input.applePreorderDate);
  const preorderEnabled = input.applePreorder === true && Boolean(preorderDate);

  const metadata = compactObject({
    type: providerReleaseType(input.type),
    title: normalizeProviderText(input.title) ?? input.title,
    version: normalizeProviderText(input.version),
    remixTitle: normalizeProviderText(input.remixTitle),
    label: normalizeProviderText(input.labelName),
    primaryGenre: normalizeProviderText(input.genre),
    secondaryGenre: normalizeProviderText(input.subgenre),
    language: normalizedLanguage,
    releaseDate: normalizeProviderDate(input.releaseDate),
    originalReleaseDate: normalizeProviderDate(input.originalReleaseDate),
    applePreorder: preorderEnabled,
    applePreorderDate: preorderEnabled ? preorderDate : undefined,
    licenseType: normalizedLicenseType,
    licenseInfo: normalizeProviderText(input.licenseInfo),
    review: normalizeProviderText(input.reviewNote)
      ? {
          note: normalizeProviderText(input.reviewNote),
          fileName: null,
          fileUrl: null,
          fileType: null,
        }
      : undefined,
    upc: normalizeProviderText(input.upc),
    cYear: input.copyrightYear ?? undefined,
    cLine: normalizeRightsText(input.copyrightLine),
    pYear: input.copyrightYear ?? undefined,
    pLine: normalizeRightsText(input.phonogramLine),
    coverUrl,
    isAiGenerated: input.isAiGenerated === true,
    releaseTime: normalizedReleaseTime,
    timeZone: normalizedTimeZone,
    coverSongs: input.coverSongs?.length
      ? input.coverSongs.map((song) => normalizeProviderText(song)).filter(Boolean)
      : undefined,
    participants: releaseParticipants(input),
  });

  await request(
    `/releases/${encodeURIComponent(providerReleaseId)}/metadata`,
    { method: "PATCH", body: JSON.stringify(metadata) }
  );

  const configuredPlatforms = stringArray(input.deliverySettings?.platforms);
  const configuredTerritories = (input.territories ?? []).filter(
    (territory) => territory && territory.toUpperCase() !== "WW"
  );
  const additional = additionalDeliverySettings(input);
  if (
    configuredPlatforms.length > 0 ||
    configuredTerritories.length > 0 ||
    Object.keys(additional).length > 0
  ) {
    await request(
      `/releases/${encodeURIComponent(providerReleaseId)}/delivery`,
      {
        method: "PATCH",
        body: JSON.stringify({
          delivery: compactObject({
            platforms: configuredPlatforms.length ? configuredPlatforms : undefined,
            territories: configuredTerritories.length ? configuredTerritories : undefined,
            additional: Object.keys(additional).length ? additional : undefined,
          }),
        }),
      }
    );
  }

  const providerTracks = [];
  for (const track of [...input.tracks].sort((a, b) => a.trackNumber - b.trackNumber)) {
    const audioFileKey = await uploadTrackAudio(providerReleaseId, track);
    providerTracks.push(
      compactObject({
        title: track.title,
        version: nonEmpty(track.version),
        linerNote: nonEmpty(track.linerNote),
        isrc: nonEmpty(track.isrc),
        iswc: nonEmpty(track.iswc),
        language:
          normalizeProviderLanguage(track.language) ??
          normalizeProviderLanguage(input.language),
        audioFileKey,
        tiktokStartTime: normalizeProviderMinuteSecond(track.tiktokStartTime),
        lyrics: track.lyrics
          ? {
              content: track.lyrics,
              explicit: track.explicit === true,
              cleanVersion: track.cleanVersion === true,
            }
          : undefined,
        aiAssisted: track.aiAssisted === true,
        artists:
          track.artists?.length
            ? track.artists.map((artist) => ({
                ...artist,
                name: normalizeProviderText(artist.name) ?? artist.name,
                role: artist.role.map((role) => role.toLowerCase()),
              }))
            : releaseParticipants(input),
        writers:
          track.writers?.length
            ? track.writers.map((writer) => ({
                ...writer,
                name: normalizeProviderText(writer.name) ?? writer.name,
                role: writer.role.map((role) => role.toLowerCase()),
              }))
            : undefined,
        credits:
          track.credits?.length
            ? track.credits.map((credit) => ({
                ...credit,
                name: normalizeProviderText(credit.name) ?? credit.name,
                role: credit.role.map((role) => role.toLowerCase()),
              }))
            : undefined,
      })
    );
  }

  await request(
    `/releases/${encodeURIComponent(providerReleaseId)}/tracks`,
    { method: "PUT", body: JSON.stringify({ tracks: providerTracks }) }
  );
}

function validateSubmission(input: ProviderReleasePayload): void {
  if (!input.title.trim() || !input.primaryArtistName.trim()) {
    throw new ProviderDeliveryValidationError(
      "Release title and primary artist are required for delivery."
    );
  }
  if (!input.releaseDate || !normalizeProviderDate(input.releaseDate)) {
    throw new ProviderDeliveryValidationError(
      "Release date is required in YYYY-MM-DD format for delivery."
    );
  }
  if (input.language && !normalizeProviderLanguage(input.language)) {
    throw new ProviderDeliveryValidationError(
      "Release language must use a supported ISO language value."
    );
  }
  if (input.licenseType) {
    const rawLicenseType = normalizeProviderText(input.licenseType)?.toLowerCase();
    const isDefaultCopyright = Boolean(
      rawLicenseType &&
        ["copyright", "(c)", "c", "©"].includes(rawLicenseType)
    );
    const normalizedLicenseType = normalizeProviderLicenseType(input.licenseType);
    if (!isDefaultCopyright && !normalizedLicenseType) {
      throw new ProviderDeliveryValidationError(
        "Release license type must be Copyright or Creative Commons."
      );
    }
    if (
      normalizedLicenseType === "Creative Commons" &&
      !normalizeProviderText(input.licenseInfo)
    ) {
      throw new ProviderDeliveryValidationError(
        "Creative Commons requires a valid CC 3.0 license clause in license information."
      );
    }
  }
  if (input.timeZone && !normalizeProviderTimeZone(input.timeZone)) {
    throw new ProviderDeliveryValidationError(
      "Release time zone must be a valid IANA time zone."
    );
  }
  if (input.releaseTime && !normalizeProviderReleaseTime(input.releaseTime)) {
    throw new ProviderDeliveryValidationError(
      "Release time must use 24-hour HH:MM format."
    );
  }
  if (input.tracks.length === 0) {
    throw new ProviderDeliveryValidationError(
      "At least one track is required for delivery."
    );
  }
  if (!input.artworkStorageBucket || !input.artworkStoragePath) {
    throw new ProviderDeliveryValidationError(
      "Cover artwork is required for delivery."
    );
  }

  for (const track of input.tracks) {
    if (!track.writers?.some((writer) => writer.name.trim() && writer.role.includes("instrumentalist"))) {
      throw new ProviderDeliveryValidationError(
        `Track ${track.trackNumber} needs a songwriter or composer credit before delivery.`
      );
    }
    if (track.writers.some((writer) => writer.role.some((role) => !["instrumentalist", "lyricist"].includes(role)))) {
      throw new ProviderDeliveryValidationError(
        `Track ${track.trackNumber} contains an unsupported writer role. Correct its composition credits before delivery.`
      );
    }
    if (!track.title.trim()) {
      throw new ProviderDeliveryValidationError(
        `Track ${track.trackNumber} needs a title before delivery.`
      );
    }
    if (!track.audioStorageBucket || !track.audioStoragePath) {
      throw new ProviderDeliveryValidationError(
        `Track ${track.trackNumber} is missing linked audio.`
      );
    }
    if (track.audioMimeType !== PROVIDER_AUDIO_MIME) {
      throw new ProviderDeliveryValidationError(
        `Track ${track.trackNumber} must use lossless FLAC audio for Nexo delivery. Re-upload this track as FLAC before retrying.`
      );
    }
    if (
      track.tiktokStartTime &&
      !normalizeProviderMinuteSecond(track.tiktokStartTime)
    ) {
      throw new ProviderDeliveryValidationError(
        `Track ${track.trackNumber} TikTok start time must use minute:second format, for example 0:08 or 9:40.`
      );
    }
  }
}

/**
 * Private upstream adapter. The upstream provider identity is never returned
 * to artist/label clients. Endpoint paths follow the currently documented
 * external release/track workflow.
 */
export class DistributionEngineProvider implements DistributionProvider {
  readonly name = INTERNAL_PROVIDER_KEY;
  readonly connected = true;

  async prepareRelease(input: ProviderReleasePayload): Promise<{ providerReleaseId: string }> {
    validateSubmission(input);

    const providerReleaseId = await createOrResumeDraft(input);
    await prepareProviderRelease(providerReleaseId, input);
    await rememberProviderDraft(input.releaseId, providerReleaseId, "draft");

    return { providerReleaseId };
  }

  async submitRelease(input: ProviderReleasePayload): Promise<{ providerReleaseId: string }> {
    const { providerReleaseId } = await this.prepareRelease(input);

    await request(
      `/releases/${encodeURIComponent(providerReleaseId)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({
          acceptTerms: true,
          confirmRights: true,
          confirmYoutubeRights:
            input.deliverySettings?.confirmYoutubeRights === true,
          idempotencyKey: `nexo:${input.releaseId}`,
        }),
      }
    );

    await rememberProviderDraft(input.releaseId, providerReleaseId, "submitted");
    return { providerReleaseId };
  }

  async updateRelease(
    providerReleaseId: string,
    input: Partial<ProviderReleasePayload>
  ): Promise<void> {
    await assertProviderDraft(providerReleaseId);
    const preorderDate = normalizeProviderDate(input.applePreorderDate);
    const preorderEnabled = input.applePreorder === true && Boolean(preorderDate);
    const metadata = compactObject({
      title: normalizeProviderText(input.title),
      version: normalizeProviderText(input.version),
      remixTitle: normalizeProviderText(input.remixTitle),
      label: normalizeProviderText(input.labelName),
      primaryGenre: normalizeProviderText(input.genre),
      secondaryGenre: normalizeProviderText(input.subgenre),
      language: normalizeProviderLanguage(input.language),
      releaseDate: normalizeProviderDate(input.releaseDate),
      originalReleaseDate: normalizeProviderDate(input.originalReleaseDate),
      applePreorder: input.applePreorder === undefined ? undefined : preorderEnabled,
      applePreorderDate: preorderEnabled ? preorderDate : undefined,
      licenseType: normalizeProviderLicenseType(input.licenseType),
      licenseInfo: normalizeProviderText(input.licenseInfo),
      review: normalizeProviderText(input.reviewNote)
        ? {
            note: normalizeProviderText(input.reviewNote),
            fileName: null,
            fileUrl: null,
            fileType: null,
          }
        : undefined,
      upc: normalizeProviderText(input.upc),
      cYear: input.copyrightYear ?? undefined,
      cLine: normalizeRightsText(input.copyrightLine),
      pYear: input.copyrightYear ?? undefined,
      pLine: normalizeRightsText(input.phonogramLine),
      isAiGenerated: input.isAiGenerated,
      releaseTime: normalizeProviderReleaseTime(input.releaseTime),
      timeZone: normalizeProviderTimeZone(input.timeZone),
      coverSongs: input.coverSongs?.length
        ? input.coverSongs.map((song) => normalizeProviderText(song)).filter(Boolean)
        : undefined,
    });
    if (Object.keys(metadata).length === 0) return;
    await request(
      `/releases/${encodeURIComponent(providerReleaseId)}/metadata`,
      { method: "PATCH", body: JSON.stringify(metadata) }
    );
  }

  async requestTakedown(): Promise<void> {
    throw new ProviderUnavailableError(
      "Takedown delivery requires a documented upstream takedown route; the request remains recorded in Nexo for operations review."
    );
  }

  async reinstateRelease(): Promise<void> {
    throw new ProviderUnavailableError(
      "Reinstatement requires a documented upstream reinstatement route; the request remains recorded in Nexo for operations review."
    );
  }

  async getReleaseStatus(providerReleaseId: string): Promise<ProviderStatusResult> {
    const data = unwrapData(
      await request(`/releases/${encodeURIComponent(providerReleaseId)}`)
    );
    const status = firstString(data, ["status", "release_status"]) ?? "unknown";
    return {
      providerReleaseId,
      status,
      updatedAt: new Date().toISOString(),
    };
  }

  async getDeliveryStatus(providerReleaseId: string): Promise<ProviderDeliveryStatus> {
    const raw = await request(`/releases/${encodeURIComponent(providerReleaseId)}`);
    const normalized = normalizeProviderDeliveryPayload(raw);
    return {
      providerReleaseId,
      deliveryStatus: normalized.releaseStatus,
      dspStatuses: normalized.dspStatuses,
      updatedAt: new Date().toISOString(),
    };
  }

  async getCatalog(query: ProviderCatalogQuery) {
    const qs = new URLSearchParams();
    if (query.limit) qs.set("perPage", String(query.limit));
    if (query.cursor && /^\d+$/.test(query.cursor)) qs.set("page", query.cursor);

    const raw = object(
      await request(`/releases${qs.size ? `?${qs}` : ""}`)
    );
    const items = Array.isArray(raw.data)
      ? raw.data
      : Array.isArray(raw.releases)
        ? raw.releases
        : [];
    const nextCursor =
      firstString(raw, ["next_cursor", "nextCursor"]) ??
      (typeof raw.currentPage === "number" &&
      typeof raw.totalPages === "number" &&
      raw.currentPage < raw.totalPages
        ? String(raw.currentPage + 1)
        : undefined);

    return { items, nextCursor };
  }

  async syncRelease(providerReleaseId: string) {
    return this.getReleaseStatus(providerReleaseId);
  }

  async handleWebhook(_event: ProviderWebhookEvent): Promise<void> {
    throw new ProviderUnavailableError(
      "Distribution Engine webhooks remain disabled until the provider signature contract is configured."
    );
  }
}
