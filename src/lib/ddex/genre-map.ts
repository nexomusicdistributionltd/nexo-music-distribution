const GENRE_MAP: Record<string, string> = {
  pop: "Pop",
  rock: "Rock",
  hiphop: "Hip Hop",
  "hip hop": "Hip Hop",
  "hip-hop": "Hip Hop",
  rap: "Hip Hop",
  rnb: "R&B",
  "r&b": "R&B",
  "r and b": "R&B",
  electronic: "Electronic",
  edm: "Electronic",
  dance: "Dance",
  classical: "Classical",
  jazz: "Jazz",
  country: "Country",
  folk: "Folk",
  metal: "Metal",
  reggae: "Reggae",
  blues: "Blues",
  latin: "Latin",
  soundtrack: "Soundtrack",
  spokenword: "Spoken Word",
  "spoken word": "Spoken Word",
  alternative: "Alternative",
  indie: "Indie",
  soul: "Soul",
  funk: "Funk",
  gospel: "Gospel",
  world: "World",
  ambient: "Ambient",
  house: "House",
  techno: "Techno",
  trance: "Trance",
  drumandbass: "Drum & Bass",
  "drum and bass": "Drum & Bass",
  "drum & bass": "Drum & Bass",
  "k-pop": "K-Pop",
  kpop: "K-Pop",
  afrobeat: "Afrobeat",
  afrobeats: "Afrobeat",
};

export function normalizeGenre(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  return GENRE_MAP[key] ?? trimmed;
}

/** AVS-facing genre for ERN DisplayGenre. Unknown values are not invented. */
export function mapGenreToAvs(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  return GENRE_MAP[key] ?? null;
}

/** @deprecated Use mapGenreToAvs — kept for foundation tests. */
export function mapGenreToAvsStub(raw: string | null | undefined): string | null {
  return mapGenreToAvs(raw);
}
