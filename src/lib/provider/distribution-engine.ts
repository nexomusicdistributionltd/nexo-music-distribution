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
    throw new ProviderUnavailableError(
      `Distribution Engine request failed (HTTP ${response.status}).`
    );
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

function providerReleaseType(type: ProviderReleasePayload["type"]): "Single" | "EP" | "Album" {
  if (type === "ep") return "EP";
  if (type === "album") return "Album";
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
      `Track ${track.trackNumber} must use lossless FLAC audio for Distribution Engine delivery. Re-upload this track as FLAC before retrying.`
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

async function createOrResumeDraft(input: ProviderReleasePayload): Promise<string> {
  const remembered = await existingProviderDraft(input.releaseId);
  if (remembered) return remembered;

  const created = await request("/releases", {
    method: "POST",
    body: JSON.stringify({
      participants: [{ name: input.primaryArtistName, role: ["primary"] }],
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
  const metadata = compactObject({
    type: providerReleaseType(input.type),
    title: input.title,
    version: nonEmpty(input.version),
    remixTitle: nonEmpty(input.remixTitle),
    label: nonEmpty(input.labelName),
    primaryGenre: nonEmpty(input.genre),
    secondaryGenre: nonEmpty(input.subgenre),
    language: nonEmpty(input.language),
    releaseDate: nonEmpty(input.releaseDate),
    originalReleaseDate: nonEmpty(input.originalReleaseDate),
    applePreorder: input.applePreorder === true,
    applePreorderDate: input.applePreorder ? nonEmpty(input.applePreorderDate) : undefined,
    licenseType: nonEmpty(input.licenseType),
    licenseInfo: nonEmpty(input.licenseInfo),
    upc: nonEmpty(input.upc),
    cYear: input.copyrightYear ?? undefined,
    cLine: nonEmpty(input.copyrightLine),
    pYear: input.copyrightYear ?? undefined,
    pLine: nonEmpty(input.phonogramLine),
    coverUrl,
    isAiGenerated: input.isAiGenerated === true,
    releaseTime: nonEmpty(input.releaseTime),
    timeZone: nonEmpty(input.timeZone),
    coverSongs: input.coverSongs?.length ? input.coverSongs : undefined,
    participants: [{ name: input.primaryArtistName, role: ["primary"] }],
  });

  await request(
    `/releases/${encodeURIComponent(providerReleaseId)}/metadata`,
    { method: "PATCH", body: JSON.stringify(metadata) }
  );

  const configuredPlatforms = stringArray(input.deliverySettings?.platforms);
  const configuredTerritories = (input.territories ?? []).filter(
    (territory) => territory && territory.toUpperCase() !== "WW"
  );
  if (configuredPlatforms.length > 0 || configuredTerritories.length > 0) {
    await request(
      `/releases/${encodeURIComponent(providerReleaseId)}/delivery`,
      {
        method: "PATCH",
        body: JSON.stringify({
          delivery: compactObject({
            platforms: configuredPlatforms.length ? configuredPlatforms : undefined,
            territories: configuredTerritories.length ? configuredTerritories : undefined,
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
        isrc: nonEmpty(track.isrc),
        language: nonEmpty(track.language) ?? nonEmpty(input.language),
        audioFileKey,
        artists: [{ name: input.primaryArtistName, role: ["primary"] }],
      })
    );
  }

  await request(
    `/releases/${encodeURIComponent(providerReleaseId)}/tracks`,
    {
      method: "PUT",
      body: JSON.stringify({ tracks: providerTracks }),
    }
  );
}

function validateSubmission(input: ProviderReleasePayload): void {
  if (!input.title.trim() || !input.primaryArtistName.trim()) {
    throw new ProviderDeliveryValidationError(
      "Release title and primary artist are required for delivery."
    );
  }
  if (!input.releaseDate) {
    throw new ProviderDeliveryValidationError(
      "Release date is required for delivery."
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
        `Track ${track.trackNumber} must use lossless FLAC audio for Distribution Engine delivery. Re-upload this track as FLAC before retrying.`
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

  async submitRelease(input: ProviderReleasePayload): Promise<{ providerReleaseId: string }> {
    validateSubmission(input);

    const providerReleaseId = await createOrResumeDraft(input);
    await prepareProviderRelease(providerReleaseId, input);

    await request(
      `/releases/${encodeURIComponent(providerReleaseId)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({
          acceptTerms: true,
          confirmRights: true,
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
    const metadata = compactObject({
      title: nonEmpty(input.title),
      version: nonEmpty(input.version),
      remixTitle: nonEmpty(input.remixTitle),
      label: nonEmpty(input.labelName),
      primaryGenre: nonEmpty(input.genre),
      secondaryGenre: nonEmpty(input.subgenre),
      language: nonEmpty(input.language),
      releaseDate: nonEmpty(input.releaseDate),
      originalReleaseDate: nonEmpty(input.originalReleaseDate),
      applePreorder: input.applePreorder,
      applePreorderDate: input.applePreorder ? nonEmpty(input.applePreorderDate) : undefined,
      licenseType: nonEmpty(input.licenseType),
      licenseInfo: nonEmpty(input.licenseInfo),
      upc: nonEmpty(input.upc),
      cYear: input.copyrightYear ?? undefined,
      cLine: nonEmpty(input.copyrightLine),
      pYear: input.copyrightYear ?? undefined,
      pLine: nonEmpty(input.phonogramLine),
      isAiGenerated: input.isAiGenerated,
      releaseTime: nonEmpty(input.releaseTime),
      timeZone: nonEmpty(input.timeZone),
      coverSongs: input.coverSongs?.length ? input.coverSongs : undefined,
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
    const status = await this.getReleaseStatus(providerReleaseId);
    return {
      providerReleaseId,
      deliveryStatus: status.status,
      updatedAt: status.updatedAt,
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
