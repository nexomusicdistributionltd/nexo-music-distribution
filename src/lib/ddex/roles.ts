import type { ContributorRole } from "@/lib/releases/types";

/**
 * Central contributor → DDEX AVS role map.
 * share_percent is metadata only and MUST NOT be mapped to DisplayArtist percentages.
 */

export type DdexArtistPlacement =
  | { kind: "display"; role: "MainArtist" | "FeaturedArtist" | "Artist" }
  | { kind: "contributor"; role: string };

const ROLE_MAP: Record<ContributorRole, DdexArtistPlacement> = {
  primary_artist: { kind: "display", role: "MainArtist" },
  featured_artist: { kind: "display", role: "FeaturedArtist" },
  remixer: { kind: "contributor", role: "Remixer" },
  producer: { kind: "contributor", role: "StudioProducer" },
  songwriter: { kind: "contributor", role: "ComposerLyricist" },
  composer: { kind: "contributor", role: "Composer" },
  lyricist: { kind: "contributor", role: "Lyricist" },
  mixer: { kind: "contributor", role: "Mixer" },
  engineer: { kind: "contributor", role: "Engineer" },
  publisher: { kind: "contributor", role: "MusicPublisher" },
  other: { kind: "contributor", role: "NotSpecified" },
};

export function mapContributorRole(role: string | null | undefined): DdexArtistPlacement | null {
  if (!role) return null;
  const key = role.trim() as ContributorRole;
  return ROLE_MAP[key] ?? null;
}

export function isDisplayArtistRole(role: string | null | undefined): boolean {
  const mapped = mapContributorRole(role);
  return mapped?.kind === "display";
}

/** Explicit guard: never treat share_percent as a DisplayArtist %. */
export function ignoreSharePercent(_share: number | null | undefined): void {
  void _share;
}
