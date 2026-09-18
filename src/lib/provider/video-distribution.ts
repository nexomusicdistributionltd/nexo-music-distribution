import "server-only";

import { loadDistributionAccessToken } from "./oauth/store";
import { readDistributionOAuthConfig } from "./oauth/config";

type Json = Record<string, unknown>;

export class VideoDistributionError extends Error {
  readonly code: "VIDEO_ACCESS_REQUIRED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_VALIDATION";
  readonly httpStatus?: number;

  constructor(
    message: string,
    code: VideoDistributionError["code"],
    httpStatus?: number
  ) {
    super(message);
    this.name = "VideoDistributionError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type ProviderMusicVideoInput = {
  requestId: string;
  title: string;
  primaryArtistName: string;
  providerArtistId?: number | null;
  labelName?: string | null;
  genre?: string | null;
  language?: string | null;
  releaseDate?: string | null;
  videoUrl: string;
  videoType?: string | null;
  ageRestriction?: string | null;
  isCoverVersion?: boolean;
  referenceUpc?: string | null;
  referenceIsrc?: string | null;
  deliverAppleMusic?: boolean;
  deliverVevo?: boolean;
};

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function unwrap(value: unknown): Json {
  const outer = object(value);
  const data = object(outer.data);
  return Object.keys(data).length ? data : outer;
}

function firstString(value: Json, keys: string[]): string | undefined {
  for (const key of keys) {
    const current = value[key];
    if (
      (typeof current === "string" || typeof current === "number") &&
      String(current).trim()
    ) {
      return String(current);
    }
  }
  return undefined;
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = await loadDistributionAccessToken();
  if (!token) {
    throw new VideoDistributionError(
      "Distribution authorization is unavailable.",
      "PROVIDER_UNAVAILABLE"
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
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new VideoDistributionError(
        "Music-video distribution access is not enabled for the connected distribution account.",
        "VIDEO_ACCESS_REQUIRED",
        response.status
      );
    }
    if (response.status === 400 || response.status === 409 || response.status === 422) {
      throw new VideoDistributionError(
        `The distribution provider rejected the music-video package (HTTP ${response.status}).`,
        "PROVIDER_VALIDATION",
        response.status
      );
    }
    throw new VideoDistributionError(
      `Music-video distribution request failed (HTTP ${response.status}).`,
      "PROVIDER_UNAVAILABLE",
      response.status
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

function participant(input: ProviderMusicVideoInput) {
  return {
    name: input.primaryArtistName,
    role: ["primary"],
    ...(input.providerArtistId ? { artistId: input.providerArtistId } : {}),
  };
}

export async function submitMusicVideoToProvider(
  input: ProviderMusicVideoInput
): Promise<{ providerReleaseId: string; status: string }> {
  if (!input.title.trim() || !input.primaryArtistName.trim()) {
    throw new VideoDistributionError(
      "Video title and primary artist are required.",
      "PROVIDER_VALIDATION"
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(input.videoUrl);
  } catch {
    throw new VideoDistributionError(
      "Video URL is invalid.",
      "PROVIDER_VALIDATION"
    );
  }
  if (parsed.protocol !== "https:") {
    throw new VideoDistributionError(
      "Video URL must use HTTPS.",
      "PROVIDER_VALIDATION"
    );
  }

  const participants = [participant(input)];
  const created = unwrap(
    await request("/releases", {
      method: "POST",
      body: JSON.stringify({
        participants,
        title: input.title,
        type: "MusicVideo",
        ...(input.labelName?.trim() ? { label: input.labelName.trim() } : {}),
      }),
    })
  );
  const providerReleaseId = firstString(created, ["id", "release_id", "releaseId"]);
  if (!providerReleaseId) {
    throw new VideoDistributionError(
      "The distribution provider did not return a music-video release identifier.",
      "PROVIDER_UNAVAILABLE"
    );
  }

  await request(`/releases/${encodeURIComponent(providerReleaseId)}/metadata`, {
    method: "PATCH",
    body: JSON.stringify({
      type: "MusicVideo",
      title: input.title,
      participants,
      ...(input.labelName?.trim() ? { label: input.labelName.trim() } : {}),
      ...(input.genre?.trim() ? { primaryGenre: input.genre.trim() } : {}),
      ...(input.language?.trim() ? { language: input.language.trim() } : {}),
      ...(input.releaseDate ? { releaseDate: input.releaseDate } : {}),
    }),
  });

  await request(`/releases/${encodeURIComponent(providerReleaseId)}/video`, {
    method: "PATCH",
    body: JSON.stringify({
      video: {
        videoUrl: input.videoUrl,
        videoType: input.videoType?.trim() || null,
        ageRestriction: input.ageRestriction?.trim() || null,
        isCoverVersion: input.isCoverVersion === true,
        referenceUpc: input.referenceUpc?.trim() || null,
        referenceIsrc: input.referenceIsrc?.trim() || null,
        delivery: {
          appleMusic: input.deliverAppleMusic !== false,
          vevo: input.deliverVevo !== false,
        },
        participants,
      },
    }),
  });

  await request(`/releases/${encodeURIComponent(providerReleaseId)}/submit`, {
    method: "POST",
    body: JSON.stringify({
      acceptTerms: true,
      confirmRights: true,
      idempotencyKey: `nexo-video:${input.requestId}`,
    }),
  });

  return { providerReleaseId, status: "submitted" };
}

export async function getMusicVideoProviderStatus(
  providerReleaseId: string
): Promise<string> {
  const data = unwrap(
    await request(`/releases/${encodeURIComponent(providerReleaseId)}`)
  );
  return firstString(data, ["status", "release_status"]) ?? "unknown";
}
