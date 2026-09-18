import "server-only";

import {
  distributionReference,
  isDistributionAuthorizationError,
  providerRows,
} from "@/lib/provider/distribution-reference";

/**
 * External catalog discovery adapter.
 * Returns unavailable when Spotify/Apple/source credentials are not configured.
 * NEVER invents releases.
 */

export type ExternalCatalogSource = "spotify" | "apple_music" | "other";

export type ExternalCatalogResult =
  | {
      available: false;
      source: ExternalCatalogSource | "unconfigured";
      reason: string;
      items: [];
    }
  | {
      available: true;
      source: ExternalCatalogSource;
      items: ExternalCatalogItem[];
      nextCursor?: string;
      note?: string;
    };

export type ExternalCatalogItem = {
  externalReleaseId: string;
  title: string;
  artistName: string;
  upc?: string | null;
  isrcs?: string[];
  trackCount?: number;
  raw?: Record<string, unknown>;
};

function envPresent(...keys: string[]): boolean {
  return keys.some((k) => Boolean((process.env[k] ?? "").trim()));
}

export function isExternalCatalogSourceConfigured(
  source: ExternalCatalogSource
): boolean {
  switch (source) {
    case "spotify":
      return envPresent("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET");
    case "apple_music":
      return envPresent("APPLE_MUSIC_TOKEN", "APPLE_MUSIC_KEY_ID");
    case "other":
      return envPresent("EXTERNAL_CATALOG_API_KEY");
    default:
      return false;
  }
}

export async function discoverExternalCatalog(options: {
  source: ExternalCatalogSource;
  artistExternalId?: string;
  cursor?: string;
  limit?: number;
}): Promise<ExternalCatalogResult> {
  void options.artistExternalId;
  void options.cursor;
  void options.limit;

  if (!isExternalCatalogSourceConfigured(options.source)) {
    return {
      available: false,
      source: options.source,
      reason: `External catalog source "${options.source}" is not connected. Configure server-only credentials to enable discovery. No releases were invented.`,
      items: [],
    };
  }

  // Credentials present but no live discovery adapter registered yet —
  // still refuse to invent catalog rows.
  return {
    available: false,
    source: options.source,
    reason: `Credentials for "${options.source}" appear set, but no live discovery adapter is registered. Catalog discovery remains unavailable.`,
    items: [],
  };
}


type ProviderRow = Record<string, unknown>;

function textValue(row: ProviderRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function providerArtistName(row: ProviderRow): string {
  const direct = textValue(row, [
    "primary_artist_name",
    "primaryArtistName",
    "artist_name",
    "artistName",
    "artist",
  ]);
  if (direct) return direct;

  const artists = row.artists;
  if (Array.isArray(artists)) {
    const names = artists
      .map((artist) => {
        if (typeof artist === "string") return artist.trim();
        if (!artist || typeof artist !== "object") return "";
        return textValue(artist as ProviderRow, ["name", "artist_name", "artistName"]);
      })
      .filter(Boolean);
    if (names.length) return names.join(", ");
  }
  return "";
}

function providerPlatforms(row: ProviderRow): string[] {
  const values: unknown[] = [];
  for (const key of ["platforms", "stores", "services", "dsps", "channels"]) {
    const value = row[key];
    if (Array.isArray(value)) values.push(...value);
    else if (typeof value === "string") values.push(...value.split(/[;,|]/));
  }
  return values
    .map((value) => {
      if (typeof value === "string") return value;
      if (!value || typeof value !== "object") return "";
      return textValue(value as ProviderRow, ["slug", "key", "name", "platform", "service"]);
    })
    .map((value) => value.trim().toLowerCase().replace(/[\s-]+/g, "_"))
    .filter(Boolean);
}

function providerIsrcs(row: ProviderRow): string[] {
  const isrcs = new Set<string>();
  const direct = row.isrcs;
  if (Array.isArray(direct)) {
    for (const value of direct) {
      if (typeof value === "string" && value.trim()) isrcs.add(value.trim().toUpperCase());
    }
  }
  const tracks = row.tracks;
  if (Array.isArray(tracks)) {
    for (const track of tracks) {
      if (!track || typeof track !== "object") continue;
      const isrc = textValue(track as ProviderRow, ["isrc", "ISRC", "track_isrc"]);
      if (isrc) isrcs.add(isrc.toUpperCase());
    }
  }
  return [...isrcs];
}

function providerTrackCount(row: ProviderRow, isrcs: string[]): number | undefined {
  const direct = Number(
    row.track_count ?? row.trackCount ?? row.tracks_count ?? row.number_of_tracks
  );
  if (Number.isFinite(direct) && direct >= 0) return direct;
  if (Array.isArray(row.tracks)) return row.tracks.length;
  if (isrcs.length) return isrcs.length;
  return undefined;
}

function providerCatalogItem(row: ProviderRow): ExternalCatalogItem | null {
  const externalReleaseId = textValue(row, [
    "id",
    "release_id",
    "releaseId",
    "provider_release_id",
    "providerReleaseId",
  ]);
  if (!externalReleaseId) return null;

  const isrcs = providerIsrcs(row);
  return {
    externalReleaseId,
    title: textValue(row, ["title", "release_title", "releaseTitle", "name"]),
    artistName: providerArtistName(row),
    upc:
      textValue(row, ["upc", "UPC", "barcode", "release_upc", "releaseUpc"]) || null,
    isrcs,
    trackCount: providerTrackCount(row, isrcs),
    raw: row,
  };
}

function providerPlatformMatches(
  row: ProviderRow,
  source: ExternalCatalogSource
): boolean {
  if (source === "other") return true;
  const platforms = providerPlatforms(row);
  if (!platforms.length) return false;
  if (source === "spotify") return platforms.some((value) => value.includes("spotify"));
  return platforms.some(
    (value) =>
      value === "apple" ||
      value.includes("apple_music") ||
      value.includes("itunes")
  );
}

/**
 * Admin-only catalog discovery backed by the live TooLost release API.
 *
 * This is intentionally separate from artist/label external discovery because the
 * provider account can contain catalog belonging to multiple Nexo users. Never call
 * this from owner-facing routes without an ownership filter.
 */
export async function discoverTooLostCatalog(options?: {
  source?: ExternalCatalogSource;
  page?: number;
  limit?: number;
}): Promise<ExternalCatalogResult> {
  const source = options?.source ?? "other";
  const page = Math.max(1, Math.trunc(options?.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(options?.limit ?? 25)));

  try {
    const raw = await distributionReference.releasesLive({ page, perPage: limit });
    const providerCatalog = providerRows(raw);
    const hasPlatformMetadata = providerCatalog.some(
      (row) => providerPlatforms(row).length > 0
    );
    const filtered = providerCatalog.filter((row) =>
      providerPlatformMatches(row, source)
    );
    const items = filtered
      .map(providerCatalogItem)
      .filter((item): item is ExternalCatalogItem => Boolean(item));

    return {
      available: true,
      source,
      items,
      nextCursor: providerCatalog.length >= limit ? String(page + 1) : undefined,
      note:
        source !== "other" && !hasPlatformMetadata
          ? "TooLost catalog is connected, but this release page did not expose platform delivery flags, so no platform-specific releases were claimed."
          : undefined,
    };
  } catch (error) {
    const authDenied = isDistributionAuthorizationError(error, "read:releases");
    return {
      available: false,
      source,
      reason: authDenied
        ? "TooLost catalog access needs reauthorization. Reconnect the provider and grant read:releases."
        : error instanceof Error
          ? error.message
          : "TooLost catalog discovery is unavailable.",
      items: [],
    };
  }
}

export function defaultUnavailableCatalog(): ExternalCatalogResult {
  return {
    available: false,
    source: "unconfigured",
    reason:
      "No external catalog source is configured. Migration discovery is unavailable.",
    items: [],
  };
}
