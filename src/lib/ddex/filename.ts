const UNSAFE = /[^A-Za-z0-9._-]+/g;

export function sanitizeFilenamePart(raw: string, fallback = "release"): string {
  const cleaned = raw.trim().replace(UNSAFE, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return (cleaned || fallback).slice(0, 80);
}

/**
 * Download / MessageFileName: NEXO_<release>_<message>_ERN432.xml
 */
export function ern432Filename(releaseTitle: string, messageId: string): string {
  const release = sanitizeFilenamePart(releaseTitle, "release");
  const message = sanitizeFilenamePart(messageId, "message");
  return `NEXO_${release}_${message}_ERN432.xml`;
}

export function privateResourceUri(kind: "audio" | "image", filename: string): string {
  const safe = sanitizeFilenamePart(filename, kind);
  return `resources/${kind}/${safe}`;
}

export function isPublicOrRemoteUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^(https?:)?\/\//i.test(value.trim());
}
