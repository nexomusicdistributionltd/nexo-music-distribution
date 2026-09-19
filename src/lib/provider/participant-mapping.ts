export type ProviderContributor = {
  name: string;
  role: string[];
  artistId?: number;
};

const ROLE_MAP: Record<string, string | null> = {
  primary_artist: "primary",
  featured_artist: "featuring",
  remixer: "remixer",

  lead_vocals: "performer",
  vocals: "performer",
  background_vocals: "performer",
  choir: "performer",
  choir_member: "performer",
  chorus: "performer",
  guitar: "performer",
  bass_guitar: "performer",
  drums: "performer",
  keyboards: "performer",
  percussion: "performer",
  instrumentalist: "performer",

  // TooLost writer contract: instrumentalist means Composer in the writers array.
  songwriter: "instrumentalist",
  composer: "instrumentalist",
  lyricist: "lyricist",
  arranger: "arranger",

  producer: "producer",

  recording_engineer: null,
  mixing_engineer: null,
  mastering_engineer: null,
  mixer: null,
  engineer: null,
  graphic_designer: null,
  publisher: null,
  a_and_r: null,
  artist_manager: null,
  sampled_artist: null,
  licensed_verse: null,
  licensed_beat: null,
  other: null,
};

export function providerRoleForContributor(role: string): string | null {
  return ROLE_MAP[role] ?? null;
}

export function groupProviderContributors(
  rows: Array<{ name: string; role: string; artistId?: number }>
): ProviderContributor[] {
  const grouped = new Map<string, ProviderContributor>();
  for (const row of rows) {
    const providerRole = providerRoleForContributor(row.role);
    const name = row.name
      .normalize("NFKC")
      .replace(/[\u00A0\u2007\u202F]/g, " ")
      .replace(/[\u200B-\u200D\u2060\uFE0E\uFE0F]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!providerRole || !name) continue;

    const key = name.toLocaleLowerCase("en-US");
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        name,
        role: [providerRole],
        ...(row.artistId ? { artistId: row.artistId } : {}),
      });
      continue;
    }

    if (!current.role.includes(providerRole)) current.role.push(providerRole);
    if (!current.artistId && row.artistId) current.artistId = row.artistId;
  }
  return [...grouped.values()].sort((left, right) => {
    const leftPrimary = left.role.includes("primary") ? 0 : 1;
    const rightPrimary = right.role.includes("primary") ? 0 : 1;
    return leftPrimary - rightPrimary;
  });
}
