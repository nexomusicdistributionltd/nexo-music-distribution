const GENRE_STUB: Record<string, string> = {
  pop: "Pop",
  rock: "Rock",
  hiphop: "Hip Hop",
  "hip hop": "Hip Hop",
  "hip-hop": "Hip Hop",
  rnb: "R&B",
  "r&b": "R&B",
  electronic: "Electronic",
  edm: "Electronic",
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
};

export function normalizeGenre(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  return GENRE_STUB[key] ?? trimmed;
}

export function mapGenreToAvsStub(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  return GENRE_STUB[key] ?? null;
}
