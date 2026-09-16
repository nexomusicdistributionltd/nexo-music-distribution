/** Artist/label DSP profile linking — metadata only, not commercial DSP API access. */

export type DspProfileKey =
  | "spotify"
  | "applemusic"
  | "audiomack"
  | "youtube"
  | "youtubemusic"
  | "amazonmusic"
  | "tidal"
  | "deezer"
  | "soundcloud"
  | "tiktok";

export type DspProfileSpec = {
  key: DspProfileKey;
  title: string;
  hosts: string[];
  oembed?: (url: string) => string;
};

export const DSP_PROFILE_SPECS: DspProfileSpec[] = [
  {
    key: "spotify",
    title: "Spotify",
    hosts: ["open.spotify.com", "spotify.com"],
    oembed: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  },
  {
    key: "applemusic",
    title: "Apple Music",
    hosts: ["music.apple.com"],
  },
  {
    key: "audiomack",
    title: "Audiomack",
    hosts: ["audiomack.com"],
  },
  {
    key: "youtube",
    title: "YouTube",
    hosts: ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"],
    oembed: (url) =>
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    key: "youtubemusic",
    title: "YouTube Music",
    hosts: ["music.youtube.com"],
  },
  {
    key: "amazonmusic",
    title: "Amazon Music",
    hosts: ["music.amazon.com", "music.amazon.co.uk"],
  },
  {
    key: "tidal",
    title: "TIDAL",
    hosts: ["tidal.com", "listen.tidal.com"],
  },
  {
    key: "deezer",
    title: "Deezer",
    hosts: ["deezer.com", "www.deezer.com"],
  },
  {
    key: "soundcloud",
    title: "SoundCloud",
    hosts: ["soundcloud.com"],
    oembed: (url) =>
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    key: "tiktok",
    title: "TikTok",
    hosts: ["tiktok.com", "www.tiktok.com"],
  },
];

export type ArtistDspLink = {
  dsp_key: DspProfileKey;
  url: string | null;
  enabled: boolean;
  preview_name: string | null;
  preview_image_url: string | null;
  preview_canonical_url: string | null;
};

export type DspProfilePreview = {
  name: string | null;
  image: string | null;
  canonicalUrl: string | null;
};

function hostMatches(hostname: string, allowed: string[]): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return allowed.some((a) => {
    const n = a.toLowerCase().replace(/^www\./, "");
    return h === n || h.endsWith(`.${n}`);
  });
}

export function specForDsp(key: string): DspProfileSpec | null {
  return DSP_PROFILE_SPECS.find((s) => s.key === key) ?? null;
}

export function detectDspFromUrl(raw: string): DspProfileKey | null {
  const parsed = parseHttpUrl(raw);
  if (!parsed) return null;
  for (const spec of DSP_PROFILE_SPECS) {
    if (hostMatches(parsed.hostname, spec.hosts)) return spec.key;
  }
  return null;
}

export function parseHttpUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

export function validateDspProfileUrl(
  key: string,
  raw: string | null | undefined
): { ok: true; url: string | null } | { ok: false; error: string } {
  const spec = specForDsp(key);
  if (!spec) return { ok: false, error: "Unknown DSP." };
  const value = (raw ?? "").trim();
  if (!value) return { ok: true, url: null };
  const parsed = parseHttpUrl(value);
  if (!parsed) return { ok: false, error: `Invalid ${spec.title} URL.` };
  if (parsed.protocol !== "https:") {
    return { ok: false, error: `${spec.title} profile links must use https.` };
  }
  if (!hostMatches(parsed.hostname, spec.hosts)) {
    return { ok: false, error: `URL is not a ${spec.title} profile.` };
  }
  return { ok: true, url: parsed.toString() };
}

export function enabledDspTargets(links: ArtistDspLink[]): ArtistDspLink[] {
  return links.filter((l) => l.enabled && l.url);
}

export function parseOpenGraph(html: string): DspProfilePreview {
  const pick = (prop: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      "i"
    );
    return html.match(re)?.[1] ?? html.match(re2)?.[1] ?? null;
  };
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null;
  return {
    name: decodeEntities(pick("og:title") || pick("twitter:title") || titleTag),
    image: decodeEntities(pick("og:image") || pick("twitter:image")),
    canonicalUrl: decodeEntities(pick("og:url")),
  };
}

function decodeEntities(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
