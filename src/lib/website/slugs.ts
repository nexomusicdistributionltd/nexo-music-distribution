/** Canonical public URL helpers for artist/release pages. */

export function releaseCanonicalPath(slugOrId: string | null | undefined, id: string): string {
  const s = (slugOrId || "").trim();
  return `/release/${s || id}`;
}

export function artistCanonicalPath(slug: string | null | undefined, fallbackId?: string): string {
  const s = (slug || "").trim();
  if (s) return `/artist/${s}`;
  if (fallbackId) return `/artist/${fallbackId}`;
  return "/artists";
}

export function legacyMusicPath(slugOrId: string): string {
  return `/music/${slugOrId}`;
}

export function legacyArtistsPath(slug: string): string {
  return `/artists/${slug}`;
}
