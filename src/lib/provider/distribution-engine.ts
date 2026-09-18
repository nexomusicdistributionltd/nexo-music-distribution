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
import { ProviderUnavailableError } from "./errors";

type Json = Record<string, unknown>;
type ProviderTrack = { id: string | number; title?: string | null };

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function firstString(o: Json, keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof o[key] === "string" && o[key]) return o[key] as string;
    if (typeof o[key] === "number") return String(o[key]);
  }
  return undefined;
}

function unwrapData(value: unknown): unknown {
  const row = object(value);
  return "data" in row ? row.data : value;
}

function rows(value: unknown): Json[] {
  const unwrapped = unwrapData(value);
  if (Array.isArray(unwrapped)) {
    return unwrapped.filter((item) => item && typeof item === "object") as Json[];
  }
  const row = object(unwrapped);
  for (const key of ["tracks", "releases", "items"]) {
    if (Array.isArray(row[key])) {
      return (row[key] as unknown[]).filter(
        (item) => item && typeof item === "object"
      ) as Json[];
    }
  }
  return [];
}

function releaseId(value: unknown): string {
  const row = object(unwrapData(value));
  const id = firstString(row, ["id", "release_id", "releaseId"]);
  if (!id) {
    throw new ProviderUnavailableError(
      "Distribution Engine did not return a release identifier."
    );
  }
  return id;
}

async function request(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const token = await loadDistributionAccessToken();
  if (!token) {
    throw new ProviderUnavailableError(
      "Distribution Engine authorization is unavailable."
    );
  }

  const cfg = readDistributionOAuthConfig();
  const response = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ProviderUnavailableError(
      `Distribution Engine request failed (HTTP ${response.status}).`
    );
  }
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderUnavailableError(
      "Distribution Engine returned an invalid response."
    );
  }
}

function providerReleaseType(type: ProviderReleasePayload["type"]): "Single" | "EP" | "Album" {
  if (type === "ep") return "EP";
  if (type === "album") return "Album";
  return "Single";
}

function contributorRole(role: string): string {
  switch (role) {
    case "primary_artist":
      return "primary";
    case "featured_artist":
      return "featured";
    case "songwriter":
      return "songwriter";
    case "composer":
      return "composer";
    case "lyricist":
      return "lyricist";
    case "producer":
      return "producer";
    case "mixer":
      return "mixer";
    case "engineer":
      return "engineer";
    case "remixer":
      return "remixer";
    default:
      return role.replace(/_/g, " ");
  }
}

async function persistProviderDraftLink(
  localReleaseId: string,
  providerReleaseId: string
): Promise<void> {
  const service = createServiceClient();
  const now = new Date().toISOString();

  const { error: releaseError } = await service
    .from("releases")
    .update({
      provider_name: "distribution_engine",
      provider_release_id: providerReleaseId,
      provider_status: "draft",
      updated_at: now,
    })
    .eq("id", localReleaseId);
  if (releaseError) {
    throw new ProviderUnavailableError(
      "Distribution Engine draft was created but Nexo could not persist its delivery reference."
    );
  }

  await service
    .from("distribution_jobs")
    .update({
      provider_name: "distribution_engine",
      provider_release_id: providerReleaseId,
      updated_at: now,
    })
    .eq("release_id", localReleaseId);
}

async function signedArtworkUrl(
  bucket: string,
  path: string
): Promise<string> {
  const service = createServiceClient();
  const { data, error } = await service.storage
    .from(bucket)
    .createSignedUrl(path, 7 * 24 * 60 * 60);
  if (error || !data?.signedUrl) {
    throw new ProviderUnavailableError(
      "Release artwork could not be prepared for delivery."
    );
  }
  return data.signedUrl;
}

async function uploadAudioToProvider(input: {
  localBucket: string;
  localPath: string;
  fileName: string;
  mimeType: string;
  providerReleaseId: string;
  providerTrackId: string;
}): Promise<void> {
  if (input.mimeType !== "audio/flac" && !input.fileName.toLowerCase().endsWith(".flac")) {
    throw new ProviderUnavailableError(
      "The current Distribution Engine upload endpoint requires FLAC audio. Replace this track audio with FLAC before delivery."
    );
  }

  const uploadResponse = object(
    unwrapData(
      await request(
        `/releases/${encodeURIComponent(input.providerReleaseId)}/tracks/upload-url`,
        {
          method: "POST",
          body: {
            kind: "audio",
            fileName: input.fileName,
            contentType: "audio/flac",
          },
        }
      )
    )
  );

  const uploadUrl = firstString(uploadResponse, ["uploadUrl", "upload_url"]);
  const fileKey = firstString(uploadResponse, ["fileKey", "file_key"]);
  const method = firstString(uploadResponse, ["method"]) ?? "PUT";
  const providerHeaders = object(uploadResponse.headers);

  if (!uploadUrl || !fileKey) {
    throw new ProviderUnavailableError(
      "Distribution Engine did not return an audio upload destination."
    );
  }

  const service = createServiceClient();
  const { data: blob, error } = await service.storage
    .from(input.localBucket)
    .download(input.localPath);
  if (error || !blob) {
    throw new ProviderUnavailableError(
      "Nexo could not read the track audio for delivery."
    );
  }

  const upload = await fetch(uploadUrl, {
    method,
    headers: Object.fromEntries(
      Object.entries(providerHeaders)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    ),
    body: new Uint8Array(await blob.arrayBuffer()),
    cache: "no-store",
  });
  if (!upload.ok) {
    throw new ProviderUnavailableError(
      `Distribution Engine audio upload failed (HTTP ${upload.status}).`
    );
  }

  await request(
    `/releases/${encodeURIComponent(input.providerReleaseId)}/tracks/${encodeURIComponent(input.providerTrackId)}/file`,
    {
      method: "PATCH",
      body: { kind: "audio", fileKey },
    }
  );
}

async function loadReleaseDeliveryData(localReleaseId: string) {
  const service = createServiceClient();
  const [
    { data: release, error: releaseError },
    { data: tracks, error: tracksError },
    { data: contributors, error: contributorsError },
    { data: assets, error: assetsError },
    { data: submission, error: submissionError },
  ] = await Promise.all([
    service
      .from("releases")
      .select("*")
      .eq("id", localReleaseId)
      .maybeSingle(),
    service
      .from("release_tracks")
      .select("*")
      .eq("release_id", localReleaseId)
      .order("track_number", { ascending: true }),
    service
      .from("release_contributors")
      .select("*")
      .eq("release_id", localReleaseId),
    service
      .from("release_assets")
      .select("*")
      .eq("release_id", localReleaseId)
      .order("created_at", { ascending: true }),
    service
      .from("release_submissions")
      .select("id,validation_snapshot,submitted_at")
      .eq("release_id", localReleaseId)
      .eq("superseded", false)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (
    releaseError ||
    tracksError ||
    contributorsError ||
    assetsError ||
    submissionError ||
    !release
  ) {
    throw new ProviderUnavailableError(
      "Nexo could not assemble the approved release for delivery."
    );
  }

  return {
    release,
    tracks: tracks ?? [],
    contributors: contributors ?? [],
    assets: assets ?? [],
    submission,
  };
}

/**
 * Private upstream adapter. Provider identity is intentionally not exposed.
 * The write workflow uses the provider's documented release lifecycle:
 * create draft -> metadata -> tracks -> audio -> delivery -> submit.
 * Every provider acknowledgement is verified before Nexo marks submission successful.
 */
export class DistributionEngineProvider implements DistributionProvider {
  readonly name = "distribution_engine";
  readonly connected = true;

  async submitRelease(input: ProviderReleasePayload): Promise<{ providerReleaseId: string }> {
    const local = await loadReleaseDeliveryData(input.releaseId);
    const confirmations = object(
      object(local.submission?.validation_snapshot).confirmations
    );

    if (
      confirmations.terms_accepted !== true ||
      confirmations.rights_confirmed !== true ||
      confirmations.youtube_rights_confirmed !== true
    ) {
      throw new ProviderUnavailableError(
        "Release rights confirmations are missing. Return the release for changes and resubmit it before delivery."
      );
    }

    const releaseContributors = local.contributors.filter(
      (row) => row.track_id == null
    );
    const artistContributors = releaseContributors.filter((row) =>
      ["primary_artist", "featured_artist", "remixer"].includes(String(row.role))
    );
    const participants =
      artistContributors.length > 0
        ? artistContributors.map((row) => ({
            name: String(row.name),
            role: [contributorRole(String(row.role))],
          }))
        : [
            {
              name: String(local.release.primary_artist_name),
              role: ["primary"],
            },
          ];

    let providerReleaseId =
      typeof local.release.provider_release_id === "string" &&
      local.release.provider_release_id
        ? local.release.provider_release_id
        : null;

    if (!providerReleaseId) {
      const created = await request("/releases", {
        method: "POST",
        body: {
          participants,
          title: local.release.title,
          type: providerReleaseType(local.release.release_type),
          label: local.release.label_name || null,
        },
      });
      providerReleaseId = releaseId(created);
      await persistProviderDraftLink(input.releaseId, providerReleaseId);
    }

    const artwork = local.assets.find((asset) => asset.kind === "artwork");
    if (!artwork) {
      throw new ProviderUnavailableError(
        "Release artwork is missing from the approved delivery package."
      );
    }
    const coverUrl = await signedArtworkUrl(
      String(artwork.storage_bucket),
      String(artwork.storage_path)
    );

    await request(
      `/releases/${encodeURIComponent(providerReleaseId)}/metadata`,
      {
        method: "PATCH",
        body: {
          type: providerReleaseType(local.release.release_type),
          title: local.release.title,
          version: local.release.version || null,
          label: local.release.label_name || null,
          primaryGenre: local.release.genre || null,
          secondaryGenre: local.release.subgenre || null,
          language: local.release.language || null,
          releaseDate: local.release.release_date || null,
          originalReleaseDate: local.release.original_release_date || null,
          cYear: local.release.copyright_year || null,
          cLine: local.release.copyright_line || null,
          pYear: local.release.copyright_year || null,
          pLine: local.release.phonogram_line || null,
          upc: local.release.upc || null,
          coverUrl,
          participants,
        },
      }
    );

    const trackPayload = local.tracks.map((track) => {
      const applicable = local.contributors.filter(
        (row) => row.track_id == null || row.track_id === track.id
      );
      const artists = applicable
        .filter((row) =>
          ["primary_artist", "featured_artist", "remixer"].includes(String(row.role))
        )
        .map((row) => ({
          name: String(row.name),
          role: [contributorRole(String(row.role))],
        }));
      const writers = applicable
        .filter((row) =>
          ["songwriter", "composer", "lyricist"].includes(String(row.role))
        )
        .map((row) => ({
          name: String(row.name),
          role: [contributorRole(String(row.role))],
        }));
      const credits = applicable
        .filter((row) =>
          ["producer", "mixer", "engineer"].includes(String(row.role))
        )
        .map((row) => ({
          name: String(row.name),
          role: [contributorRole(String(row.role))],
        }));

      return {
        title: track.title,
        version: track.version || null,
        isrc: track.isrc || null,
        language: track.language || local.release.language || null,
        lyrics: track.lyrics
          ? {
              content: track.lyrics,
              explicit: Boolean(track.explicit),
              cleanVersion: !track.explicit,
            }
          : null,
        artists: artists.length ? artists : participants,
        writers: writers.length ? writers : null,
        credits: credits.length ? credits : null,
      };
    });

    const replaced = await request(
      `/releases/${encodeURIComponent(providerReleaseId)}/tracks`,
      {
        method: "PUT",
        body: { tracks: trackPayload },
      }
    );

    let providerTracks = rows(replaced).map((row) => ({
      id: firstString(row, ["id", "track_id", "trackId"]) ?? "",
      title: firstString(row, ["title"]) ?? null,
    })).filter((row): row is ProviderTrack => Boolean(row.id));

    if (providerTracks.length !== local.tracks.length) {
      providerTracks = rows(
        await request(
          `/releases/${encodeURIComponent(providerReleaseId)}/tracks`
        )
      ).map((row) => ({
        id: firstString(row, ["id", "track_id", "trackId"]) ?? "",
        title: firstString(row, ["title"]) ?? null,
      })).filter((row): row is ProviderTrack => Boolean(row.id));
    }

    if (providerTracks.length !== local.tracks.length) {
      throw new ProviderUnavailableError(
        "Distribution Engine returned an unexpected track count."
      );
    }

    const audioAssets = local.assets.filter((asset) => asset.kind === "audio");
    const linkedAudio = new Map(
      audioAssets
        .filter((asset) => Boolean(asset.track_id))
        .map((asset) => [String(asset.track_id), asset])
    );
    const unlinkedAudio = audioAssets.filter((asset) => !asset.track_id);

    for (let index = 0; index < local.tracks.length; index += 1) {
      const localTrack = local.tracks[index];
      const providerTrack = providerTracks[index];
      const audio =
        linkedAudio.get(String(localTrack.id)) ??
        (linkedAudio.size === 0 && unlinkedAudio.length === local.tracks.length
          ? unlinkedAudio[index]
          : null);
      if (!audio) {
        throw new ProviderUnavailableError(
          `Track ${index + 1} is missing its linked audio file.`
        );
      }

      await uploadAudioToProvider({
        localBucket: String(audio.storage_bucket),
        localPath: String(audio.storage_path),
        fileName: String(audio.filename),
        mimeType: String(audio.mime_type),
        providerReleaseId,
        providerTrackId: String(providerTrack.id),
      });
    }

    await request(
      `/releases/${encodeURIComponent(providerReleaseId)}/delivery`,
      {
        method: "PATCH",
        body: {
          delivery: {
            territories:
              Array.isArray(local.release.territories) && local.release.territories.length
                ? local.release.territories
                : ["WW"],
          },
        },
      }
    );

    await request(
      `/releases/${encodeURIComponent(providerReleaseId)}/submit`,
      {
        method: "POST",
        body: {
          acceptTerms: true,
          confirmRights: true,
          confirmYoutubeRights: true,
          idempotencyKey: `nexo-${input.releaseId}`,
        },
      }
    );

    return { providerReleaseId };
  }

  async updateRelease(
    providerReleaseId: string,
    input: Partial<ProviderReleasePayload>
  ): Promise<void> {
    const body: Json = {};
    if (input.title !== undefined) body.title = input.title;
    if (input.releaseDate !== undefined) body.releaseDate = input.releaseDate;
    if (input.upc !== undefined) body.upc = input.upc;
    if (Object.keys(body).length === 0) return;

    await request(
      `/releases/${encodeURIComponent(providerReleaseId)}/metadata`,
      { method: "PATCH", body }
    );
  }

  async requestTakedown(): Promise<void> {
    throw new ProviderUnavailableError(
      "Takedown delivery is awaiting a verified Distribution Engine endpoint."
    );
  }

  async reinstateRelease(): Promise<void> {
    throw new ProviderUnavailableError(
      "Reinstatement is awaiting a verified Distribution Engine endpoint."
    );
  }

  async getReleaseStatus(providerReleaseId: string): Promise<ProviderStatusResult> {
    const data = object(
      unwrapData(
        await request(`/releases/${encodeURIComponent(providerReleaseId)}`)
      )
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
    if (query.cursor) qs.set("page", query.cursor);
    const raw = await request(
      `/releases${qs.size ? `?${qs.toString()}` : ""}`
    );
    return {
      items: rows(raw),
      nextCursor: undefined,
    };
  }

  async syncRelease(providerReleaseId: string) {
    return this.getReleaseStatus(providerReleaseId);
  }

  async handleWebhook(_event: ProviderWebhookEvent): Promise<void> {
    throw new ProviderUnavailableError(
      "Distribution Engine webhooks are not enabled until signature verification is documented."
    );
  }
}
