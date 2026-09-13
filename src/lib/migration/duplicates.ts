/**
 * Duplicate detection for catalog migration.
 * Detects by ISRC, UPC, and optional audio fingerprint hash.
 */

import { normalizeIsrc, normalizeUpc } from "./identifiers";

export type ExistingTrackRef = {
  trackId: string;
  releaseId: string;
  title: string;
  isrc?: string | null;
  audioHash?: string | null;
};

export type ExistingReleaseRef = {
  releaseId: string;
  title: string;
  upc?: string | null;
  primaryArtistName?: string | null;
};

export type DuplicateMatch = {
  kind: "isrc" | "upc" | "fingerprint" | "title_artist";
  existingReleaseId: string;
  existingTrackId?: string;
  message: string;
};

export const EXISTING_TRACK_PROMPT = "Does this track already exist?";

export function detectTrackDuplicates(options: {
  isrcs?: Array<string | null | undefined>;
  audioHash?: string | null;
  title?: string | null;
  artistName?: string | null;
  existingTracks: ExistingTrackRef[];
  existingReleases?: ExistingReleaseRef[];
  upc?: string | null;
}): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const isrcSet = new Set(
    (options.isrcs ?? [])
      .map((i) => normalizeIsrc(i))
      .filter((x): x is string => Boolean(x))
  );

  for (const t of options.existingTracks) {
    const tIsrc = normalizeIsrc(t.isrc);
    if (tIsrc && isrcSet.has(tIsrc)) {
      matches.push({
        kind: "isrc",
        existingReleaseId: t.releaseId,
        existingTrackId: t.trackId,
        message: `${EXISTING_TRACK_PROMPT} Matched ISRC ${tIsrc} on an existing track.`,
      });
    }
    if (
      options.audioHash &&
      t.audioHash &&
      options.audioHash === t.audioHash
    ) {
      matches.push({
        kind: "fingerprint",
        existingReleaseId: t.releaseId,
        existingTrackId: t.trackId,
        message: `${EXISTING_TRACK_PROMPT} Audio fingerprint matches an existing track.`,
      });
    }
  }

  const upc = normalizeUpc(options.upc);
  if (upc && options.existingReleases) {
    for (const r of options.existingReleases) {
      if (normalizeUpc(r.upc) === upc) {
        matches.push({
          kind: "upc",
          existingReleaseId: r.releaseId,
          message: `Duplicate UPC ${upc} matches an existing release.`,
        });
      }
    }
  }

  if (options.title && options.artistName && options.existingReleases) {
    const title = options.title.trim().toLowerCase();
    const artist = options.artistName.trim().toLowerCase();
    for (const r of options.existingReleases) {
      if (
        r.title.trim().toLowerCase() === title &&
        (r.primaryArtistName ?? "").trim().toLowerCase() === artist
      ) {
        matches.push({
          kind: "title_artist",
          existingReleaseId: r.releaseId,
          message: `Title + artist match an existing release — review as possible duplicate.`,
        });
      }
    }
  }

  return matches;
}

export function hasOpenConflict(matches: DuplicateMatch[]): boolean {
  return matches.length > 0;
}
