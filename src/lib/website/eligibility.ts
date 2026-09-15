/**
 * Public music catalog eligibility — truthful, never invents LIVE.
 * A release appears on /music only when website_published is true.
 * UI must still show real distribution status (or omit status claims).
 */

export type WebsiteReleaseFields = {
  website_published?: boolean | null;
  website_featured?: boolean | null;
  website_playback_enabled?: boolean | null;
  status?: string | null;
};

export function isPublicMusicEligible(r: WebsiteReleaseFields): boolean {
  return r.website_published === true;
}

/** Signed-URL audio preview only when published AND playback enabled. */
export function canOfferWebsitePlayback(r: WebsiteReleaseFields): boolean {
  return r.website_published === true && r.website_playback_enabled === true;
}

/** Prefer official DSP embeds over hosted audio. */
export function hasOfficialEmbed(r: {
  website_embed_spotify_url?: string | null;
  website_embed_apple_url?: string | null;
  website_embed_youtube_url?: string | null;
}): boolean {
  return Boolean(
    r.website_embed_spotify_url ||
      r.website_embed_apple_url ||
      r.website_embed_youtube_url
  );
}

/** Never label as LIVE unless status truly is live/delivered. */
export function publicStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  if (status === "live") return "Live on DSPs";
  if (status === "delivered") return "Delivered";
  // Do not invent LIVE for drafts / scheduled / etc.
  return null;
}
