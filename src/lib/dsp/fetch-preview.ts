import "server-only";

import {
  parseHttpUrl,
  parseOpenGraph,
  specForDsp,
  type DspProfilePreview,
} from "./profile-links";

const FETCH_MS = 4000;
const MAX_BYTES = 400_000;

export async function fetchDspProfilePreview(
  dspKey: string,
  url: string
): Promise<DspProfilePreview> {
  const empty: DspProfilePreview = { name: null, image: null, canonicalUrl: url };
  const parsed = parseHttpUrl(url);
  if (!parsed) return empty;
  const spec = specForDsp(dspKey);

  if (spec?.oembed) {
    const oembed = await fetchJson(spec.oembed(parsed.toString()));
    if (oembed) {
      return {
        name: stringOrNull(oembed.title) ?? stringOrNull(oembed.author_name),
        image: stringOrNull(oembed.thumbnail_url),
        canonicalUrl: parsed.toString(),
      };
    }
  }

  const html = await fetchText(parsed.toString());
  if (!html) return empty;
  const og = parseOpenGraph(html);
  return {
    name: og.name,
    image: og.image && parseHttpUrl(og.image) ? og.image : null,
    canonicalUrl: og.canonicalUrl && parseHttpUrl(og.canonicalUrl) ? og.canonicalUrl : parsed.toString(),
  };
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetchWithTimeout(url, { Accept: "application/json" });
    if (!res?.ok) return null;
    const data = (await res.json()) as unknown;
    if (!data || typeof data !== "object") return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, { Accept: "text/html" });
    if (!res?.ok) return null;
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    return new TextDecoder("utf-8").decode(slice);
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, headers: Record<string, string>) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    return await fetch(url, {
      method: "GET",
      headers: { ...headers, "User-Agent": "NexoMusicDistribution/1.0" },
      redirect: "follow",
      signal: ctrl.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
