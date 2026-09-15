/**
 * Outbound DSP listen links — never used as primary embedded players.
 */

import { isSafeHttpUrl } from "./sanitize";

export type DspOutboundLink = {
  label: string;
  href: string;
  kind: "spotify" | "apple" | "youtube" | "other";
};

export function buildDspOutboundLinks(r: {
  website_embed_spotify_url?: string | null;
  website_embed_apple_url?: string | null;
  website_embed_youtube_url?: string | null;
}): DspOutboundLink[] {
  const out: DspOutboundLink[] = [];
  if (r.website_embed_spotify_url && isSafeHttpUrl(r.website_embed_spotify_url)) {
    out.push({
      label: "Listen on Spotify",
      href: r.website_embed_spotify_url,
      kind: "spotify",
    });
  }
  if (r.website_embed_apple_url && isSafeHttpUrl(r.website_embed_apple_url)) {
    out.push({
      label: "Listen on Apple Music",
      href: r.website_embed_apple_url,
      kind: "apple",
    });
  }
  if (r.website_embed_youtube_url && isSafeHttpUrl(r.website_embed_youtube_url)) {
    out.push({
      label: "Watch on YouTube",
      href: r.website_embed_youtube_url,
      kind: "youtube",
    });
  }
  return out;
}
