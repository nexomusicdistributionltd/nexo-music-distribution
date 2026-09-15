/**
 * Move In Catalog validation — artist-provided import + duplicate protection.
 * Never invents Spotify/Apple results. Never invents ISRC/UPC.
 */

import { detectTrackDuplicates, type DuplicateMatch } from "./duplicates";
import { isValidIsrc, isValidUpc, normalizeIsrc, normalizeUpc } from "./identifiers";

export type MoveInImportMethod =
  | "unconfigured"
  | "external_api"
  | "artist_json"
  | "artist_csv"
  | "manual";

export type ArtistProvidedCatalogItem = {
  title?: string | null;
  artist_name?: string | null;
  upc?: string | null;
  isrcs?: string[] | null;
  track_count?: number | null;
  previous_distributor?: string | null;
  external_release_id?: string | null;
  [key: string]: unknown;
};

export type MetadataGap =
  | "missing_title"
  | "missing_upc"
  | "missing_isrc"
  | "invalid_upc"
  | "invalid_isrc"
  | "missing_artist";

export type ValidatedMoveInItem = {
  title: string | null;
  artistName: string | null;
  upc: string | null;
  isrcs: string[];
  gaps: MetadataGap[];
  duplicates: DuplicateMatch[];
  previousDistributor: string | null;
  raw: ArtistProvidedCatalogItem;
};

/**
 * Resolve import method for UI/storage.
 * Pass `externalConfigured=true` only when server confirmed real API credentials.
 * Never invents that Spotify/Apple are connected.
 */
export function resolveImportMethod(
  preferred?: string | null,
  externalConfigured = false
): MoveInImportMethod {
  if (preferred === "external_api") {
    return externalConfigured ? "external_api" : "unconfigured";
  }
  if (preferred === "artist_json" || preferred === "artist_csv" || preferred === "manual") {
    return preferred;
  }
  return "manual";
}

export function detectMetadataGaps(item: ArtistProvidedCatalogItem): MetadataGap[] {
  const gaps: MetadataGap[] = [];
  if (!item.title || !String(item.title).trim()) gaps.push("missing_title");
  if (!item.artist_name || !String(item.artist_name).trim()) gaps.push("missing_artist");

  const upcRaw = item.upc != null ? String(item.upc) : "";
  if (!upcRaw.trim()) gaps.push("missing_upc");
  else if (!isValidUpc(upcRaw)) gaps.push("invalid_upc");

  const isrcs = (item.isrcs ?? []).map((x) => String(x ?? "")).filter(Boolean);
  if (isrcs.length === 0) gaps.push("missing_isrc");
  else if (isrcs.some((i) => !isValidIsrc(i))) gaps.push("invalid_isrc");

  return gaps;
}

export function validateMoveInItems(
  items: ArtistProvidedCatalogItem[],
  existing: {
    tracks: Parameters<typeof detectTrackDuplicates>[0]["existingTracks"];
    releases: NonNullable<Parameters<typeof detectTrackDuplicates>[0]["existingReleases"]>;
  }
): ValidatedMoveInItem[] {
  return items.map((item) => {
    const gaps = detectMetadataGaps(item);
    const upc = normalizeUpc(item.upc != null ? String(item.upc) : null);
    const isrcs = (item.isrcs ?? [])
      .map((i) => normalizeIsrc(String(i ?? "")))
      .filter((x): x is string => Boolean(x));

    const duplicates = detectTrackDuplicates({
      isrcs,
      upc,
      title: item.title != null ? String(item.title) : null,
      artistName: item.artist_name != null ? String(item.artist_name) : null,
      existingTracks: existing.tracks,
      existingReleases: existing.releases,
    });

    return {
      title: item.title != null ? String(item.title).trim() || null : null,
      artistName: item.artist_name != null ? String(item.artist_name).trim() || null : null,
      upc: upc && isValidUpc(upc) ? upc : upc, // keep normalized even if invalid → gap flagged
      isrcs: isrcs.filter((i) => isValidIsrc(i)),
      gaps,
      duplicates,
      previousDistributor:
        item.previous_distributor != null
          ? String(item.previous_distributor).trim() || null
          : null,
      raw: item,
    };
  });
}

export function parseCatalogJson(text: string): ArtistProvidedCatalogItem[] {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) return parsed as ArtistProvidedCatalogItem[];
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)) {
    return (parsed as { items: ArtistProvidedCatalogItem[] }).items;
  }
  throw new Error("JSON must be an array of releases or { items: [] }.");
}

/** Minimal CSV: title,artist_name,upc,isrcs (isrcs pipe-separated) */
export function parseCatalogCsv(text: string): ArtistProvidedCatalogItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const start = header.includes("title") ? 1 : 0;
  const rows = start === 1 ? lines.slice(1) : lines;
  const idx = (name: string, fallback: number) => {
    const i = header.indexOf(name);
    return i >= 0 ? i : fallback;
  };
  const titleI = start === 1 ? idx("title", 0) : 0;
  const artistI = start === 1 ? idx("artist_name", 1) : 1;
  const upcI = start === 1 ? idx("upc", 2) : 2;
  const isrcI = start === 1 ? idx("isrcs", 3) : 3;

  return rows.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const isrcRaw = cols[isrcI] ?? "";
    return {
      title: cols[titleI] || null,
      artist_name: cols[artistI] || null,
      upc: cols[upcI] || null,
      isrcs: isrcRaw
        ? isrcRaw.split(/[|;]/).map((s) => s.trim()).filter(Boolean)
        : [],
    };
  });
}

export const WORKFLOW_STEPS = ["search", "select", "review", "move_in", "done"] as const;
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

export function isWorkflowStep(v: string): v is WorkflowStep {
  return (WORKFLOW_STEPS as readonly string[]).includes(v);
}
