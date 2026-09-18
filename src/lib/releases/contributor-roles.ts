import type { ContributorRole } from "./types";

export type ContributorCreditCategory =
  | "display"
  | "performer"
  | "composition"
  | "production"
  | "administrative";

export const CONTRIBUTOR_ROLE_OPTIONS: Array<{
  value: ContributorRole;
  label: string;
  category: ContributorCreditCategory;
}> = [
  { value: "primary_artist", label: "Primary Artist", category: "display" },
  { value: "featured_artist", label: "Featured Artist", category: "display" },
  { value: "remixer", label: "Remixer", category: "display" },

  { value: "lead_vocals", label: "Lead Vocals / Lead Singer", category: "performer" },
  { value: "vocals", label: "Vocals / Singer", category: "performer" },
  { value: "background_vocals", label: "Background / Backing Vocals", category: "performer" },
  { value: "choir", label: "Choir", category: "performer" },
  { value: "choir_member", label: "Choir Member", category: "performer" },
  { value: "chorus", label: "Chorus / Ensemble Vocals", category: "performer" },
  { value: "guitar", label: "Guitar / Guitarist", category: "performer" },
  { value: "bass_guitar", label: "Bass Guitar / Bassist", category: "performer" },
  { value: "drums", label: "Drums / Drummer", category: "performer" },
  { value: "keyboards", label: "Keyboard / Piano", category: "performer" },
  { value: "percussion", label: "Percussion", category: "performer" },
  { value: "instrumentalist", label: "Instrumentalist / Background Musician", category: "performer" },

  { value: "songwriter", label: "Songwriter", category: "composition" },
  { value: "composer", label: "Composer", category: "composition" },
  { value: "lyricist", label: "Lyricist", category: "composition" },
  { value: "arranger", label: "Arranger", category: "composition" },

  { value: "producer", label: "Producer", category: "production" },
  { value: "recording_engineer", label: "Recording Engineer", category: "production" },
  { value: "mixing_engineer", label: "Mixing Engineer", category: "production" },
  { value: "mastering_engineer", label: "Mastering Engineer", category: "production" },
  { value: "mixer", label: "Mixer", category: "production" },
  { value: "engineer", label: "Engineer", category: "production" },
  { value: "graphic_designer", label: "Graphic Designer", category: "administrative" },

  { value: "publisher", label: "Publisher", category: "administrative" },
  { value: "a_and_r", label: "A&R", category: "administrative" },
  { value: "artist_manager", label: "Artist Manager", category: "administrative" },
  { value: "sampled_artist", label: "Sampled Artist", category: "administrative" },
  { value: "licensed_verse", label: "Licensed Verse", category: "administrative" },
  { value: "licensed_beat", label: "Licensed Beat", category: "administrative" },
  { value: "other", label: "Other", category: "administrative" },
];

export const PERFORMER_CREDIT_ROLES = new Set<ContributorRole>(
  CONTRIBUTOR_ROLE_OPTIONS
    .filter((role) => role.category === "display" || role.category === "performer")
    .map((role) => role.value)
);

export const COMPOSITION_CREDIT_ROLES = new Set<ContributorRole>(
  CONTRIBUTOR_ROLE_OPTIONS
    .filter((role) => role.category === "composition")
    .map((role) => role.value)
);

export const PRODUCTION_CREDIT_ROLES = new Set<ContributorRole>(
  CONTRIBUTOR_ROLE_OPTIONS
    .filter((role) => role.category === "production")
    .map((role) => role.value)
);
