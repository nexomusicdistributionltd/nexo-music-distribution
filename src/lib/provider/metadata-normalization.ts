export function normalizeProviderText(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[\u200B-\u200D\u2060\uFE0E\uFE0F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || undefined;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  english: "en",
  portuguese: "pt",
  "brazilian portuguese": "pt",
  spanish: "es",
  french: "fr",
  german: "de",
  italian: "it",
  dutch: "nl",
  arabic: "ar",
  hindi: "hi",
  japanese: "ja",
  korean: "ko",
  chinese: "zh",
  mandarin: "zh",
  russian: "ru",
  turkish: "tr",
  polish: "pl",
  swedish: "sv",
  norwegian: "no",
  danish: "da",
  finnish: "fi",
  greek: "el",
  hebrew: "he",
  indonesian: "id",
  malay: "ms",
  thai: "th",
  vietnamese: "vi",
  ukrainian: "uk",
  romanian: "ro",
  hungarian: "hu",
  czech: "cs",
  slovak: "sk",
  croatian: "hr",
  serbian: "sr",
  bulgarian: "bg",
  catalan: "ca",
  afrikaans: "af",
  swahili: "sw",
  yoruba: "yo",
  igbo: "ig",
  hausa: "ha",
  "non-linguistic": "zxx",
  instrumental: "zxx",
};

export function normalizeProviderLanguage(value: string | null | undefined): string | undefined {
  const text = normalizeProviderText(value);
  if (!text) return undefined;
  const lower = text.toLowerCase().replace(/_/g, "-");
  if (/^[a-z]{2}$/.test(lower) || lower === "zxx") return lower;
  return LANGUAGE_ALIASES[lower];
}

export function normalizeProviderLicenseType(
  value: string | null | undefined
): "Creative Commons" | undefined {
  const text = normalizeProviderText(value)?.toLowerCase();
  if (!text) return undefined;
  // Copyright is the provider default and is safest omitted from the metadata PATCH.
  if (["copyright", "(c)", "c", "©"].includes(text)) return undefined;
  if (["creative commons", "creative_commons", "creative-commons", "cc"].includes(text)) {
    return "Creative Commons";
  }
  return undefined;
}

const TIME_ZONE_ALIASES: Record<string, string> = {
  chicago: "America/Chicago",
  "central time": "America/Chicago",
  "new york": "America/New_York",
  "eastern time": "America/New_York",
  denver: "America/Denver",
  "mountain time": "America/Denver",
  "los angeles": "America/Los_Angeles",
  "pacific time": "America/Los_Angeles",
  lagos: "Africa/Lagos",
  london: "Europe/London",
  paris: "Europe/Paris",
  dubai: "Asia/Dubai",
  tokyo: "Asia/Tokyo",
  sydney: "Australia/Sydney",
};

export function normalizeProviderTimeZone(value: string | null | undefined): string | undefined {
  const text = normalizeProviderText(value);
  if (!text) return undefined;
  const candidate = TIME_ZONE_ALIASES[text.toLowerCase()] ?? text;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return undefined;
  }
}

export function normalizeProviderReleaseTime(value: string | null | undefined): string | undefined {
  const text = normalizeProviderText(value);
  if (!text) return undefined;
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : undefined;
}

export function normalizeProviderMinuteSecond(
  value: string | null | undefined
): string | undefined {
  const text = normalizeProviderText(value);
  if (!text) return undefined;
  const match = text.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return undefined;
  const minutes = Number(match[1]);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return undefined;
  return `${minutes}:${match[2]}`;
}

export function normalizeProviderDate(value: string | null | undefined): string | undefined {
  const text = normalizeProviderText(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text
    ? undefined
    : text;
}

export function normalizeRightsText(value: string | null | undefined): string | undefined {
  const text = normalizeProviderText(value);
  if (!text) return undefined;
  return text
    .replace(/^(?:©|℗|\(c\)|\(p\))\s*/i, "")
    .trim() || undefined;
}
