/**
 * Official DSP embed helpers — legal embeds only (Spotify / Apple / YouTube).
 */

import { isSafeHttpUrl } from "./sanitize";

function hostnameMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

export type EmbedKind = "spotify" | "apple" | "youtube" | "vimeo";

export function spotifyEmbedSrc(url: string): string | null {
  if (!isSafeHttpUrl(url)) return null;
  try {
    const u = new URL(url);
    if (!hostnameMatches(u.hostname, "spotify.com")) return null;
    // https://open.spotify.com/album/ID → /embed/album/ID
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const type = parts[0];
    const id = parts[1]?.split("?")[0];
    if (!["track", "album", "playlist", "artist", "episode", "show"].includes(type) || !id) {
      return null;
    }
    return `https://open.spotify.com/embed/${type}/${id}`;
  } catch {
    return null;
  }
}

export function appleMusicEmbedSrc(url: string): string | null {
  if (!isSafeHttpUrl(url)) return null;
  try {
    const u = new URL(url);
    if (!hostnameMatches(u.hostname, "apple.com") && !hostnameMatches(u.hostname, "itunes.apple.com")) {
      return null;
    }
    // Prefer embed.music.apple.com when already an embed URL
    if (u.hostname.startsWith("embed.")) return u.toString();
    return `https://embed.music.apple.com${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

export function youtubeEmbedSrc(url: string): string | null {
  if (!isSafeHttpUrl(url)) return null;
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (hostnameMatches(u.hostname, "youtu.be")) {
      id = u.pathname.replace("/", "") || null;
    } else if (hostnameMatches(u.hostname, "youtube.com")) {
      id = u.searchParams.get("v");
      if (!id && (u.pathname.startsWith("/embed/") || u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/live/"))) {
        id = u.pathname.split("/")[2] || null;
      }
    }
    if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}`;
  } catch {
    return null;
  }
}

export function vimeoEmbedSrc(url: string): string | null {
  if (!isSafeHttpUrl(url)) return null;
  try {
    const u = new URL(url);
    if (!hostnameMatches(u.hostname, "vimeo.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const id = [...parts].reverse().find((part) => /^\d+$/.test(part));
    if (!id) return null;
    return `https://player.vimeo.com/video/${id}`;
  } catch {
    return null;
  }
}

export function directVideoSrc(url: string): string | null {
  if (!isSafeHttpUrl(url)) return null;
  try {
    const u = new URL(url);
    return /\.(?:mp4|webm|ogg|m4v)$/i.test(u.pathname) ? u.toString() : null;
  } catch {
    return null;
  }
}

export function resolveEmbed(
  kind: EmbedKind,
  url: string | null | undefined
): string | null {
  if (!url) return null;
  if (kind === "spotify") return spotifyEmbedSrc(url);
  if (kind === "apple") return appleMusicEmbedSrc(url);
  if (kind === "vimeo") return vimeoEmbedSrc(url);
  return youtubeEmbedSrc(url);
}
