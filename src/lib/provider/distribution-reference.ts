import "server-only";

import { loadDistributionAccessToken } from "./oauth/store";
import { readDistributionOAuthConfig } from "./oauth/config";
import { ProviderUnavailableError } from "./errors";

type Json = Record<string, unknown>;
export type DistributionLookupOption = { value: string; label: string };

async function api(path: string) {
  const token = await loadDistributionAccessToken();
  if (!token) {
    throw new ProviderUnavailableError("Distribution Engine authorization is unavailable.");
  }
  const config = readDistributionOAuthConfig();
  const response = await fetch(config.apiBaseUrl.replace(/\/$/, "") + path, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ProviderUnavailableError(
      `Distribution Engine request failed (HTTP ${response.status}).`
    );
  }
  return response.json();
}

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function rows(value: unknown): Json[] {
  const outer = object(value);
  const data = object(outer.data);
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
    if (Array.isArray(data[key])) return data[key] as Json[];
    if (Array.isArray(outer[key])) return outer[key] as Json[];
  }
  if (Array.isArray(outer.data)) return outer.data as Json[];
  return [];
}

function firstString(row: Json, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

function lookupOptions(value: unknown, kind: "genre" | "language" | "platform") {
  const seen = new Set<string>();
  const result: DistributionLookupOption[] = [];
  for (const row of rows(value)) {
    const valueKeys =
      kind === "language"
        ? ["code", "iso", "value", "slug", "id", "name"]
        : ["slug", "code", "value", "id", "name", "label"];
    const optionValue = firstString(row, valueKeys);
    const label = firstString(row, ["name", "label", "title", "display_name", "displayName"]) ?? optionValue;
    if (!optionValue || !label || seen.has(optionValue)) continue;
    seen.add(optionValue);
    result.push({ value: optionValue, label });
  }
  return result.sort((a, b) => a.label.localeCompare(b.label));
}

export const distributionReference = {
  me: () => api("/me"),
  releases: () => api("/releases"),
  release: (id: string) => api("/releases/" + encodeURIComponent(id)),
  releaseTracks: (id: string) => api("/releases/" + encodeURIComponent(id) + "/tracks"),
  countries: () => api("/lookup/countries"),
  platforms: () => api("/lookup/platforms"),
  genres: () => api("/lookup/genres"),
  languages: () => api("/lookup/languages"),
  salesOverview: () => api("/sales/overview"),
  salesTracks: () => api("/sales/tracks"),
  salesReleases: () => api("/sales/releases"),
  salesArtists: () => api("/sales/artists"),
  salesChannels: () => api("/sales/channels"),
  salesTerritories: () => api("/sales/territories"),
  streamRates: () => api("/sales/stream-rates"),
  analytics: () => api("/analytics"),
  preferences: () => api("/preferences"),
};

export async function distributionMetadataLookups() {
  const [genres, languages, platforms] = await Promise.allSettled([
    distributionReference.genres(),
    distributionReference.languages(),
    distributionReference.platforms(),
  ]);
  return {
    genres:
      genres.status === "fulfilled" ? lookupOptions(genres.value, "genre") : [],
    languages:
      languages.status === "fulfilled" ? lookupOptions(languages.value, "language") : [],
    platforms:
      platforms.status === "fulfilled" ? lookupOptions(platforms.value, "platform") : [],
  };
}

export async function distributionDashboardData() {
  const [releases, platforms, countries, genres, languages] = await Promise.allSettled([
    distributionReference.releases(),
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
