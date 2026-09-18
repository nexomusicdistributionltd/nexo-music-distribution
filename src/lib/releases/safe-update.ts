/** Allowlisted columns for owner release updates (mass-assignment shield). */
export const RELEASE_UPDATE_ALLOWLIST = [
  "title",
  "version",
  "primary_artist_name",
  "genre",
  "subgenre",
  "language",
  "release_date",
  "original_release_date",
  "label_name",
  "copyright_year",
  "copyright_line",
  "phonogram_line",
  "upc",
  "explicit",
  "description",
  "territories",
  "distribution_settings",
  "release_type",
] as const;

export type ReleaseUpdateAllowKey = (typeof RELEASE_UPDATE_ALLOWLIST)[number];

const PRIVILEGED_RELEASE_KEYS = [
  "status",
  "provider_name",
  "provider_release_id",
  "provider_status",
  "provider_metadata",
  "provider_connected",
  "locked_at",
  "submitted_at",
  "owner_user_id",
  "rejection_reason",
  "changes_requested_reason",
  "id",
  "created_at",
  "artist_profile_id",
  "label_profile_id",
] as const;

export function pickReleaseUpdateFields(
  patch: Record<string, unknown>
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const key of RELEASE_UPDATE_ALLOWLIST) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      safe[key] = patch[key];
    }
  }
  for (const key of PRIVILEGED_RELEASE_KEYS) {
    delete safe[key];
  }
  if (safe.distribution_settings !== undefined) {
    const ds = safe.distribution_settings;
    if (ds && typeof ds === "object" && !Array.isArray(ds)) {
      const cleaned = { ...(ds as Record<string, unknown>) };
      delete cleaned.provider_connected;
      delete cleaned.provider_release_id;
      delete cleaned.provider_status;
      delete cleaned.provider;
      safe.distribution_settings = cleaned;
    }
  }
  return safe;
}

/** Strip PostgREST .or() metacharacters from catalog search input. */
export function sanitizeReleaseSearchQuery(raw: string): string {
  return raw
    .replace(/[%_,()."'\\:*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
