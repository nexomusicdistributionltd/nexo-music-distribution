import "server-only";

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

export function defaultUnavailableCatalog(): ExternalCatalogResult {
  return {
    available: false,
    source: "unconfigured",
    reason:
      "No external catalog source is configured. Migration discovery is unavailable.",
    items: [],
  };
}
