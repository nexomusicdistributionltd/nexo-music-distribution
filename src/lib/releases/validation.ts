import type { ReleaseRow, ReleaseTrackRow, ReleaseAssetRow, ReleaseContributorRow, ReleaseType } from "./types";
import {
  COMPOSITION_CREDIT_ROLES,
  PERFORMER_CREDIT_ROLES,
  PRODUCTION_CREDIT_ROLES,
} from "./contributor-roles";

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
      return { min: 1, max: 6 };
    case "album":
      return { min: 1, max: 100 };
    case "compilation":
      return { min: 1, max: 100 };
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
  tracks: Pick<
    ReleaseTrackRow,
    "track_number" | "title" | "isrc" | "id" | "duration_ms"
  >[];
  assets: Pick<ReleaseAssetRow, "kind" | "track_id" | "mime_type">[];
  contributors: Pick<ReleaseContributorRow, "name" | "role" | "track_id">[];
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

  const knownDurations = tracks
    .map((track) => track.duration_ms)
    .filter((duration): duration is number => typeof duration === "number" && duration >= 0);
  const totalDurationMs = knownDurations.reduce((sum, duration) => sum + duration, 0);
  const allDurationsKnown = knownDurations.length === tracks.length;
  const tenMinutesMs = 10 * 60 * 1000;
  const thirtyMinutesMs = 30 * 60 * 1000;

  if (
    release.release_type === "single" &&
    allDurationsKnown &&
    tracks.some((track) => (track.duration_ms ?? 0) >= tenMinutesMs)
  ) {
    issues.push({
      field: "tracks",
      message:
        "A Single can contain 1–3 tracks only when each track is under 10 minutes. Use EP when a 1–3 track release contains a 10+ minute track.",
    });
  }

  if (release.release_type === "ep" && allDurationsKnown) {
    const standardEp =
      tracks.length >= 4 &&
      tracks.length <= 6 &&
      totalDurationMs <= thirtyMinutesMs;
    const longTrackEp =
      tracks.length >= 1 &&
      tracks.length <= 3 &&
      tracks.some((track) => (track.duration_ms ?? 0) >= tenMinutesMs) &&
      totalDurationMs <= thirtyMinutesMs;
    if (!standardEp && !longTrackEp) {
      issues.push({
        field: "tracks",
        message:
          "EP classification requires 4–6 tracks up to 30 minutes, or 1–3 tracks with at least one 10+ minute track and a total of 30 minutes or less.",
      });
    }
  }

  if (
    release.release_type === "album" &&
    allDurationsKnown &&
    tracks.length < 7 &&
    totalDurationMs <= thirtyMinutesMs
  ) {
    issues.push({
      field: "tracks",
      message:
        "Album classification requires 7+ tracks or a total runtime over 30 minutes.",
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

  const audioAssets = assets.filter((a) => a.kind === "audio");
  const incompatibleAudio = audioAssets.filter((a) => a.mime_type !== "audio/flac");
  if (incompatibleAudio.length > 0) {
    issues.push({
      field: "audio",
      message: "Distribution delivery requires lossless FLAC audio. Re-upload non-FLAC tracks before submitting.",
    });
  }
  if (audioAssets.length < tracks.length) {
    issues.push({
      field: "audio",
      message: "Each track must have an audio file before submit.",
    });
  } else {
    // Prefer per-track linkage when track_id is present on assets
    const linked = new Set(
      audioAssets.map((a) => a.track_id).filter((id): id is string => Boolean(id))
    );
    if (linked.size > 0) {
      for (const t of tracks) {
        const trackId = (t as { id?: string }).id;
        if (trackId && !linked.has(trackId)) {
          issues.push({
            field: `track.${t.track_number}.audio`,
            message: `Track ${t.track_number} is missing linked audio.`,
          });
        }
      }
    }
  }

  const namedContributors = contributors.filter((c) => Boolean(c.name?.trim()));
  if (!namedContributors.length) {
    issues.push({
      field: "contributors",
      message: "Complete contributor credits are required.",
    });
  } else {
    for (const track of tracks) {
      const scoped = namedContributors.filter(
        (contributor) => !contributor.track_id || contributor.track_id === track.id
      );
      const contributorRoles = new Set(scoped.map((contributor) => contributor.role));
      if (![...contributorRoles].some((role) => PERFORMER_CREDIT_ROLES.has(role))) {
        issues.push({
          field: `track.${track.track_number}.contributors`,
          message: `Track ${track.track_number} needs an accurate performer credit (for example lead vocals, vocals, choir, instrument, primary or featured artist).`,
        });
      }
      if (![...contributorRoles].some((role) => COMPOSITION_CREDIT_ROLES.has(role))) {
        issues.push({
          field: `track.${track.track_number}.contributors`,
          message: `Track ${track.track_number} needs a composition/lyrics credit (songwriter, composer, lyricist or arranger).`,
        });
      }
      if (![...contributorRoles].some((role) => PRODUCTION_CREDIT_ROLES.has(role))) {
        issues.push({
          field: `track.${track.track_number}.contributors`,
          message: `Track ${track.track_number} needs a production/engineering credit (for example producer, recording, mixing or mastering engineer).`,
        });
      }
    }
  }

  // Never fabricate codes
  if (release.upc === "AUTO" || release.upc === "GENERATE") {
    issues.push({ field: "upc", message: "UPC cannot be auto-generated." });
  }

  return issues;
}
