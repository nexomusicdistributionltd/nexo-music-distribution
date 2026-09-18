import type { ReleaseType } from "@/lib/releases/types";

const HASH_ALG: Record<string, string> = {
  sha256: "SHA-256",
  "sha-256": "SHA-256",
  sha1: "SHA1",
  md5: "MD5",
};

const AUDIO_CODEC: Record<string, string> = {
  pcm: "PCM",
  wav: "PCM",
  flac: "FLAC",
  mp3: "MP3",
  mpeg: "MP3",
  "mpeg 1 layer 3": "MP3",
  aac: "AAC",
  vorbis: "Vorbis",
};

const CONTAINER: Record<string, string> = {
  wav: "WAV",
  wave: "WAV",
  aiff: "AIFF",
  aif: "AIFF",
  flac: "WAV",
  mp4: "MP4",
  m4a: "MP4",
  ogg: "Ogg",
};

const IMAGE_CODEC: Record<string, string> = {
  jpeg: "JPEG",
  jpg: "JPEG",
  png: "PNG",
  gif: "GIF",
  tiff: "TIFF",
  tif: "TIFF",
};

const USE_TYPES = new Set([
  "OnDemandStream",
  "PermanentDownload",
  "ConditionalDownload",
  "NonInteractiveStream",
  "Stream",
  "Download",
  "Broadcast",
]);

const COMMERCIAL_MODELS = new Set([
  "SubscriptionModel",
  "PayAsYouGoModel",
  "AdvertisementSupportedModel",
  "FreeOfChargeModel",
]);

export function mapHashAlgorithm(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return HASH_ALG[raw.trim().toLowerCase()] ?? null;
}

export function mapAudioCodec(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return AUDIO_CODEC[raw.trim().toLowerCase()] ?? null;
}

export function mapContainerFormat(raw: string | null | undefined, filename?: string | null): string | null {
  const fromRaw = raw?.trim() ? CONTAINER[raw.trim().toLowerCase()] : null;
  if (fromRaw) return fromRaw;
  const ext = filename?.split(".").pop()?.toLowerCase();
  return ext ? CONTAINER[ext] ?? null : null;
}

export function mapImageCodec(raw: string | null | undefined, mime?: string | null, filename?: string | null): string | null {
  if (raw?.trim()) {
    const mapped = IMAGE_CODEC[raw.trim().toLowerCase()];
    if (mapped) return mapped;
  }
  const mimeSub = mime?.split("/")[1]?.toLowerCase();
  if (mimeSub && IMAGE_CODEC[mimeSub]) return IMAGE_CODEC[mimeSub];
  const ext = filename?.split(".").pop()?.toLowerCase();
  return ext ? IMAGE_CODEC[ext] ?? null : null;
}

export function mapReleaseTypeToAvs(type: ReleaseType | string): "Single" | "EP" | "Album" | "Compilation" | null {
  const t = String(type).trim().toLowerCase();
  if (t === "single") return "Single";
  if (t === "ep") return "EP";
  if (t === "album") return "Album";
  if (t === "compilation") return "Compilation";
  return null;
}

export function mapLanguageToCode(raw: string | null | undefined): string {
  if (!raw?.trim()) return "en";
  const v = raw.trim().toLowerCase();
  const table: Record<string, string> = {
    en: "en",
    eng: "en",
    english: "en",
    es: "es",
    spanish: "es",
    fr: "fr",
    french: "fr",
    de: "de",
    german: "de",
    pt: "pt",
    portuguese: "pt",
    it: "it",
    italian: "it",
    ja: "ja",
    japanese: "ja",
    ko: "ko",
    korean: "ko",
    zh: "zh",
    chinese: "zh",
  };
  if (table[v]) return table[v];
  if (/^[a-zA-Z]{2,3}$/.test(raw.trim())) return raw.trim().toLowerCase();
  return "en";
}

export function isAllowedUseType(value: string): boolean {
  return USE_TYPES.has(value);
}

export function isAllowedCommercialModel(value: string): boolean {
  return COMMERCIAL_MODELS.has(value);
}

export function parseLineYear(
  line: string | null | undefined,
  fallback: number | null | undefined
): number | null {
  if (typeof fallback === "number" && fallback >= 1000 && fallback <= 9999) return fallback;
  const m = line?.match(/\b(19|20)\d{2}\b/);
  if (m) return Number(m[0]);
  return null;
}
