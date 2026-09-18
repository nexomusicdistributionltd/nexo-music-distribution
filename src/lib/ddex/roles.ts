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
  lead_vocals: { kind: "contributor", role: "LeadVocalist" },
  vocals: { kind: "contributor", role: "Vocalist" },
  background_vocals: { kind: "contributor", role: "BackgroundVocalist" },
  choir: { kind: "contributor", role: "Choir" },
  choir_member: { kind: "contributor", role: "ChoirMember" },
  chorus: { kind: "contributor", role: "Choir" },
  guitar: { kind: "contributor", role: "Musician" },
  bass_guitar: { kind: "contributor", role: "Musician" },
  drums: { kind: "contributor", role: "Musician" },
  keyboards: { kind: "contributor", role: "Musician" },
  percussion: { kind: "contributor", role: "Musician" },
  instrumentalist: { kind: "contributor", role: "Musician" },
  producer: { kind: "contributor", role: "StudioProducer" },
  songwriter: { kind: "contributor", role: "ComposerLyricist" },
  composer: { kind: "contributor", role: "Composer" },
  lyricist: { kind: "contributor", role: "Lyricist" },
  arranger: { kind: "contributor", role: "MusicArranger" },
  recording_engineer: { kind: "contributor", role: "RecordingEngineer" },
  mixing_engineer: { kind: "contributor", role: "MixingEngineer" },
  mastering_engineer: { kind: "contributor", role: "MasteringEngineer" },
  mixer: { kind: "contributor", role: "MixingEngineer" },
  engineer: { kind: "contributor", role: "Engineer" },
  graphic_designer: { kind: "contributor", role: "GraphicDesigner" },
  publisher: { kind: "contributor", role: "MusicPublisher" },
  a_and_r: { kind: "contributor", role: "AAndRCoordinator" },
  artist_manager: { kind: "contributor", role: "NotSpecified" },
  sampled_artist: { kind: "contributor", role: "NotSpecified" },
  licensed_verse: { kind: "contributor", role: "AssociatedPerformer" },
  licensed_beat: { kind: "contributor", role: "AssociatedPerformer" },
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
