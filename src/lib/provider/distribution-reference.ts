import "server-only";

import { unstable_cache } from "next/cache";

import { loadDistributionAccessToken } from "./oauth/store";
import { readDistributionOAuthConfig } from "./oauth/config";
import { ProviderUnavailableError } from "./errors";

type Json = Record<string, unknown>;

export type ProviderPageQuery = {
  page?: number;
  perPage?: number;
};

export type ProviderSalesPageQuery = {
  page?: number;
  perPage?: number;
};

function clampPage(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.trunc(value));
}

function clampPerPage(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(1, Math.trunc(value)));
}

function releaseQuery(query?: ProviderPageQuery): URLSearchParams {
  const qs = new URLSearchParams();
  const page = clampPage(query?.page);
  const perPage = clampPerPage(query?.perPage);
  if (page) qs.set("page", String(page));
  if (perPage) qs.set("perPage", String(perPage));
  return qs;
}

function salesQuery(query?: ProviderSalesPageQuery): URLSearchParams {
  const qs = new URLSearchParams();
  const page = clampPage(query?.page);
  const perPage = clampPerPage(query?.perPage);
  if (page) qs.set("page", String(page));
  if (perPage) qs.set("per_page", String(perPage));
  return qs;
}

function withQuery(path: string, qs: URLSearchParams): string {
  return qs.size ? `${path}?${qs.toString()}` : path;
}

async function apiUncached(path: string): Promise<unknown> {
  const token = await loadDistributionAccessToken();
  if (!token) {
    throw new ProviderUnavailableError("Distribution Engine authorization is unavailable.");
  }

  const cfg = readDistributionOAuthConfig();
  const response = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    // Do not surface upstream provider branding or raw error prose into artist/label portals.
    // HTTP status plus rate/quota metadata is sufficient for safe operator troubleshooting.
    try {
      await response.json();
    } catch {
      // Empty/non-JSON upstream bodies are valid error responses.
    }

    const retryAfter = response.headers.get("retry-after");
    const quotaRemaining = response.headers.get("x-api-quota-remaining");
    const detail = [
      response.status === 429 && retryAfter ? `retry after ${retryAfter}s` : "",
      quotaRemaining === "0" ? "API quota remaining: 0" : "",
    ]
      .filter(Boolean)
      .join(" · ");

    throw new ProviderUnavailableError(
      `Distribution Engine request failed (HTTP ${response.status})${detail ? `: ${detail}` : "."}`
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

const cachedApiGet = unstable_cache(
  async (path: string) => apiUncached(path),
  ["distribution-engine-reference-get-v1"],
  { revalidate: 60 }
);

async function api(path: string): Promise<unknown> {
  return cachedApiGet(path);
}

/**
 * Analytics must reflect the freshest data exposed by the provider. We deliberately
 * bypass the generic 60-second reference cache here. The upstream provider can still
 * have its own reporting delay; Nexo never fabricates values between provider refreshes.
 */
async function apiLive(path: string): Promise<unknown> {
  return apiUncached(path);
}

async function apiPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const token = await loadDistributionAccessToken();
  if (!token) {
    throw new ProviderUnavailableError("Distribution Engine authorization is unavailable.");
  }
  const cfg = readDistributionOAuthConfig();
  const response = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ProviderUnavailableError(
      `Distribution Engine validation request failed (HTTP ${response.status}).`
    );
  }
  if (response.status === 204) return null;
  return response.json();
}

function rows(value: unknown): Json[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Json => Boolean(item && typeof item === "object"));
  }
  const outer = value && typeof value === "object" ? (value as Json) : {};
  if (Array.isArray(outer.data)) {
    return outer.data.filter((item): item is Json => Boolean(item && typeof item === "object"));
  }
  const data = outer.data && typeof outer.data === "object" ? (outer.data as Json) : outer;
  for (const key of [
    "releases",
    "tracks",
    "artists",
    "channels",
    "territories",
    "platforms",
    "countries",
    "genres",
    "languages",
    "analytics",
    "sales",
    "items",
  ]) {
    if (Array.isArray(data[key])) {
      return (data[key] as unknown[]).filter(
        (item): item is Json => Boolean(item && typeof item === "object")
      );
    }
  }
  if (Object.keys(data).length > 0) return [data];
  return [];
}

function id(value: string | number): string {
  return encodeURIComponent(String(value));
}

/**
 * Server-only map of documented Distribution Engine resources.
 *
 * Sales uses the documented page/per_page contract. Release listing uses page/perPage.
 * Mutating release delivery remains in distribution-engine.ts so this reference client
 * cannot accidentally expose provider writes to artist/label UI.
 */
export const distributionReference = {
  me: () => api("/me"),

  releases: (query?: ProviderPageQuery) =>
    api(withQuery("/releases", releaseQuery(query))),
  release: (releaseId: string | number) => api(`/releases/${id(releaseId)}`),
  releaseTracks: (releaseId: string | number) =>
    api(`/releases/${id(releaseId)}/tracks`),

  countries: () => api("/lookup/countries"),
  platforms: () => api("/lookup/platforms"),
  genres: () => api("/lookup/genres"),
  languages: () => api("/lookup/languages"),

  salesOverview: (query?: ProviderSalesPageQuery) =>
    apiLive(withQuery("/sales/overview", salesQuery(query))),
  salesTracks: (query?: ProviderSalesPageQuery) =>
    apiLive(withQuery("/sales/tracks", salesQuery(query))),
  salesTrackOverview: (isrc: string, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/tracks/${id(isrc)}/overview`, salesQuery(query))),
  salesTrackChannels: (isrc: string, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/tracks/${id(isrc)}/channels`, salesQuery(query))),
  salesTrackTerritories: (isrc: string, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/tracks/${id(isrc)}/territories`, salesQuery(query))),

  salesReleases: (query?: ProviderSalesPageQuery) =>
    apiLive(withQuery("/sales/releases", salesQuery(query))),
  salesReleaseOverview: (releaseId: string | number, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/releases/${id(releaseId)}/overview`, salesQuery(query))),
  salesReleaseChannels: (releaseId: string | number, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/releases/${id(releaseId)}/channels`, salesQuery(query))),
  salesReleaseTerritories: (releaseId: string | number, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/releases/${id(releaseId)}/territories`, salesQuery(query))),

  salesArtists: (query?: ProviderSalesPageQuery) =>
    apiLive(withQuery("/sales/artists", salesQuery(query))),
  salesArtistOverview: (artist: string, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/artists/${id(artist)}/overview`, salesQuery(query))),
  salesArtistChannels: (artist: string, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/artists/${id(artist)}/channels`, salesQuery(query))),
  salesArtistTerritories: (artist: string, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/artists/${id(artist)}/territories`, salesQuery(query))),

  salesChannels: (query?: ProviderSalesPageQuery) =>
    apiLive(withQuery("/sales/channels", salesQuery(query))),
  salesChannelOverview: (channel: string, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/channels/${id(channel)}/overview`, salesQuery(query))),
  salesChannelReleases: (channel: string, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/channels/${id(channel)}/releases`, salesQuery(query))),
  salesChannelTerritories: (channel: string, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/channels/${id(channel)}/territories`, salesQuery(query))),

  salesTerritories: (query?: ProviderSalesPageQuery) =>
    apiLive(withQuery("/sales/territories", salesQuery(query))),

  streamRates: (query?: ProviderSalesPageQuery) =>
    apiLive(withQuery("/sales/stream-rates", salesQuery(query))),
  streamRateOverview: (service: string, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/stream-rates/${id(service)}/overview`, salesQuery(query))),
  streamRateTerritories: (service: string, query?: ProviderSalesPageQuery) =>
    apiLive(withQuery(`/sales/stream-rates/${id(service)}/territories`, salesQuery(query))),

  analyticsOverview: () => apiLive("/analytics/overview"),
  analyticsTracks: () => apiLive("/analytics/tracks"),
  analyticsTrackCharts: () => apiLive("/analytics/tracks/charts"),
  analyticsTrack: (isrc: string) => apiLive(`/analytics/tracks/${id(isrc)}`),
  analyticsPlatforms: () => apiLive("/analytics/platforms"),
  analyticsPlatformData: () => apiLive("/analytics/platforms/data"),
  /** Compatibility alias used by existing Nexo analytics loaders. */
  analytics: () => apiLive("/analytics/overview"),

  preferences: () => api("/preferences"),
  artistPreference: () => api("/preferences/artist"),
  artistPreferences: () => api("/preferences/artists"),
  labelPreference: () => api("/preferences/label"),
  labelArtistPreference: (artistId: string | number) =>
    api(`/preferences/label/artist/${id(artistId)}`),

  validateUpc: (upc: string, releaseId?: string | number) =>
    apiPost("/releases/validate/upc", {
      upc,
      ...(releaseId != null ? { releaseId: Number(releaseId) } : {}),
    }),
  validateIsrc: (isrc: string) =>
    apiPost("/releases/validate/isrc", { isrc }),
};

export async function distributionDashboardData() {
  const [releases, platforms, countries, genres, languages] = await Promise.allSettled([
    distributionReference.releases({ page: 1, perPage: 100 }),
    distributionReference.platforms(),
    distributionReference.countries(),
    distributionReference.genres(),
    distributionReference.languages(),
  ]);
  const value = (result: PromiseSettledResult<unknown>) =>
    result.status === "fulfilled" ? rows(result.value) : [];

  return {
    releases: value(releases),
    platforms: value(platforms),
    countries: value(countries),
    genres: value(genres),
    languages: value(languages),
  };
}

const ANALYTICS_PLATFORM_HINTS = new Set([
  "spotify",
  "apple",
  "apple_music",
  "itunes",
  "youtube",
  "youtube_ugc",
  "yt_ugc",
  "amazon",
  "amazon_music",
  "audiomack",
  "deezer",
  "tidal",
  "pandora",
  "soundcloud",
  "meta",
  "facebook",
  "instagram",
  "tiktok",
  "streamsafe",
  "spotify_discovery",
  "spotify_discovery_mode",
  "spotify_engagement",
]);

const ANALYTICS_SECTION_HINTS = [
  "discovery",
  "engagement",
  "ugc",
  "content_id",
  "contentid",
  "fraud",
  "artificial",
  "suspicious",
  "streamsafe",
  "download",
  "social",
  "daily",
  "weekly",
  "hourly",
];

function analyticsHint(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isScalar(value: unknown): boolean {
  return (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function numberLike(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string" || !value.trim()) return false;
  return Number.isFinite(Number(value));
}

function deepAnalyticsRows(
  value: unknown,
  inherited: Json = {},
  parentKey = ""
): Json[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => deepAnalyticsRows(item, inherited, parentKey));
  }
  if (!value || typeof value !== "object") return [];

  const object = value as Json;
  const scalar: Json = {};
  const nested: Array<[string, unknown]> = [];

  for (const [key, entry] of Object.entries(object)) {
    if (isScalar(entry)) scalar[key] = entry;
    else nested.push([key, entry]);
  }

  const row: Json = { ...inherited, ...scalar };
  const normalizedParent = analyticsHint(parentKey);
  if (
    normalizedParent &&
    ANALYTICS_PLATFORM_HINTS.has(normalizedParent) &&
    !row.platform &&
    !row.channel &&
    !row.dsp &&
    !row.store
  ) {
    row.platform = normalizedParent;
  }
  if (
    normalizedParent &&
    ANALYTICS_SECTION_HINTS.some((hint) => normalizedParent.includes(hint)) &&
    !row.analytics_section
  ) {
    row.analytics_section = normalizedParent;
  }

  const scalarKeys = Object.keys(scalar);
  const hasNumericMetric = scalarKeys.some((key) => numberLike(scalar[key]));
  const hasKnownDimension = [
    "platform",
    "channel",
    "dsp",
    "store",
    "isrc",
    "ISRC",
    "release_id",
    "releaseId",
    "provider_release_id",
    "providerReleaseId",
    "date",
    "day",
    "week",
    "month",
    "period",
    "metric",
    "category",
    "type",
  ].some((key) => row[key] != null);

  const output: Json[] = [];
  if (hasNumericMetric && (hasKnownDimension || nested.length === 0)) {
    output.push(row);
  }

  for (const [key, entry] of nested) {
    output.push(...deepAnalyticsRows(entry, row, key));
  }

  return output;
}

export function providerAnalyticsRows(value: unknown, seed: Json = {}): Json[] {
  const flattened = deepAnalyticsRows(value, seed);
  if (flattened.length > 0) return flattened;
  return rows(value).map((row) => ({ ...seed, ...row }));
}

export function providerRows(value: unknown): Json[] {
  return rows(value);
}
