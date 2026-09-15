/**
 * Official DSP embed helpers — legal embeds only (Spotify / Apple / YouTube).
 */

import { isSafeHttpUrl } from "./sanitize";

export type EmbedKind = "spotify" | "apple" | "youtube";

export function spotifyEmbedSrc(url: string): string | null {
  if (!isSafeHttpUrl(url)) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes("spotify.com")) return null;
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
    if (!u.hostname.includes("apple.com") && !u.hostname.includes("itunes.apple.com")) {
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
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.replace("/", "") || null;
    } else if (u.hostname.includes("youtube.com")) {
      id = u.searchParams.get("v");
      if (!id && u.pathname.startsWith("/embed/")) {
        id = u.pathname.split("/")[2] || null;
      }
    }
    if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}`;
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
  return youtubeEmbedSrc(url);
}
