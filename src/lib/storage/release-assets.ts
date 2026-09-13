export const AUDIO_BUCKET = "release-audio";
export const ARTWORK_BUCKET = "release-artwork";

export const AUDIO_MIME_TYPES = [
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/mpeg",
  "audio/mp3",
  "audio/aiff",
  "audio/x-aiff",
  "audio/mp4",
  "audio/x-m4a",
] as const;

export const ARTWORK_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const MAX_AUDIO_BYTES = 500 * 1024 * 1024;
export const MAX_ARTWORK_BYTES = 50 * 1024 * 1024;

/** Storage path: {userId}/{releaseId}/{kind}-{uuid}-{safeFilename} */
export function buildAssetPath(options: {
  userId: string;
  releaseId: string;
  kind: "audio" | "artwork";
  filename: string;
  id: string;
}): string {
  assertSafeIdSegment(options.userId, "userId");
  assertSafeIdSegment(options.releaseId, "releaseId");
  const safe = sanitizeFilename(options.filename);
  return `${options.userId}/${options.releaseId}/${options.kind}-${options.id}-${safe}`;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

function assertSafeIdSegment(value: string, label: string) {
  if (!value || value.includes("..") || value.includes("/") || value.includes("\\")) {
    throw new Error(`Invalid ${label} for storage path.`);
  }
}

/**
 * Ensures a client-supplied storage path is exactly under the caller's release folder
 * and contains no path traversal.
 */
export function assertOwnedAssetPath(
  storagePath: string,
  userId: string,
  releaseId: string
): string | null {
  if (!storagePath || typeof storagePath !== "string") {
    return "Invalid storage path.";
  }
  if (
    storagePath.includes("..") ||
    storagePath.includes("\\") ||
    storagePath.startsWith("/") ||
    storagePath.includes("//") ||
    storagePath.includes("\0")
  ) {
    return "Invalid storage path.";
  }
  const prefix = `${userId}/${releaseId}/`;
  if (!storagePath.startsWith(prefix)) {
    return "Invalid storage path.";
  }
  const rest = storagePath.slice(prefix.length);
  if (!rest || rest.includes("/") || rest.includes("..")) {
    return "Invalid storage path.";
  }
  return null;
}

export function assertAudioFile(file: { type: string; size: number }): string | null {
  if (!AUDIO_MIME_TYPES.includes(file.type as (typeof AUDIO_MIME_TYPES)[number])) {
    return "Unsupported audio type. Use WAV, FLAC, MP3, AIFF, or M4A.";
  }
  if (file.size > MAX_AUDIO_BYTES) return "Audio file exceeds 500MB limit.";
  if (file.size <= 0) return "Audio file is empty.";
  return null;
}

export function assertArtworkFile(file: { type: string; size: number }): string | null {
  if (!ARTWORK_MIME_TYPES.includes(file.type as (typeof ARTWORK_MIME_TYPES)[number])) {
    return "Artwork must be JPEG, PNG, or WebP.";
  }
  if (file.size > MAX_ARTWORK_BYTES) return "Artwork exceeds 50MB limit.";
  if (file.size <= 0) return "Artwork file is empty.";
  return null;
}
