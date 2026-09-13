import type { ReleaseRow, ReleaseTrackRow, ReleaseAssetRow, ReleaseContributorRow, ReleaseType } from "./types";

export type ValidationIssue = { field: string; message: string };

export function validateUpc(upc: string | null | undefined): ValidationIssue | null {
  if (!upc) return null;
  if (!/^[0-9]{12,14}$/.test(upc)) {
    return { field: "upc", message: "UPC must be 12–14 digits when provided." };
  }
  return null;
}

export function validateIsrc(isrc: string | null | undefined): ValidationIssue | null {
  if (!isrc) return null;
  if (!/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(isrc)) {
    return {
      field: "isrc",
      message: "ISRC must match format CCXXXYYNNNNN (12 chars) when provided.",
    };
  }
  return null;
}

export function expectedTrackCount(type: ReleaseType): { min: number; max: number } {
  switch (type) {
    case "single":
      return { min: 1, max: 3 };
    case "ep":
      return { min: 2, max: 6 };
    case "album":
      return { min: 7, max: 100 };
  }
}

export function validateReleaseForSubmit(input: {
  release: Pick<
    ReleaseRow,
    | "title"
    | "primary_artist_name"
    | "release_type"
    | "genre"
    | "release_date"
    | "copyright_year"
    | "copyright_line"
    | "phonogram_line"
    | "upc"
    | "territories"
  >;
  tracks: Pick<ReleaseTrackRow, "track_number" | "title" | "isrc">[];
  assets: Pick<ReleaseAssetRow, "kind" | "track_id">[];
  contributors: Pick<ReleaseContributorRow, "name" | "role">[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { release, tracks, assets, contributors } = input;

  if (!release.title?.trim()) {
    issues.push({ field: "title", message: "Title is required." });
  }
  if (!release.primary_artist_name?.trim()) {
    issues.push({
      field: "primary_artist_name",
      message: "Primary artist name is required.",
    });
  }
  if (!release.genre?.trim()) {
    issues.push({ field: "genre", message: "Genre is required." });
  }
  if (!release.release_date) {
    issues.push({ field: "release_date", message: "Release date is required." });
  }
  if (!release.copyright_year || release.copyright_year < 1900) {
    issues.push({ field: "copyright_year", message: "Copyright year is required." });
  }
  if (!release.copyright_line?.trim()) {
    issues.push({ field: "copyright_line", message: "Copyright line (C) is required." });
  }
  if (!release.phonogram_line?.trim()) {
    issues.push({ field: "phonogram_line", message: "Phonogram line (P) is required." });
  }
  if (!release.territories?.length) {
    issues.push({ field: "territories", message: "At least one territory is required." });
  }

  const upcIssue = validateUpc(release.upc);
  if (upcIssue) issues.push(upcIssue);

  const { min, max } = expectedTrackCount(release.release_type);
  if (tracks.length < min || tracks.length > max) {
    issues.push({
      field: "tracks",
      message: `${release.release_type} requires ${min}–${max} tracks (found ${tracks.length}).`,
    });
  }

  for (const t of tracks) {
    if (!t.title?.trim()) {
      issues.push({
        field: `track.${t.track_number}.title`,
        message: `Track ${t.track_number} needs a title.`,
      });
    }
    const isrcIssue = validateIsrc(t.isrc);
    if (isrcIssue) {
      issues.push({
        field: `track.${t.track_number}.isrc`,
        message: `Track ${t.track_number}: ${isrcIssue.message}`,
      });
    }
  }

  const hasArtwork = assets.some((a) => a.kind === "artwork");
  if (!hasArtwork) {
    issues.push({ field: "artwork", message: "Cover artwork is required." });
  }

  const audioCount = assets.filter((a) => a.kind === "audio").length;
  if (audioCount < tracks.length) {
    issues.push({
      field: "audio",
      message: "Each track must have an audio file before submit.",
    });
  }

  const hasNamedContributor = contributors.some((c) => Boolean(c.name?.trim()));
  if (!hasNamedContributor) {
    issues.push({
      field: "contributors",
      message: "At least one contributor is required.",
    });
  }

  // Never fabricate codes
  if (release.upc === "AUTO" || release.upc === "GENERATE") {
    issues.push({ field: "upc", message: "UPC cannot be auto-generated." });
  }

  return issues;
}
