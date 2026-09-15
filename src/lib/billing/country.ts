const ISO_3166_1_ALPHA_2 = /^[A-Z]{2}$/;

/** Cloudflare / CDN placeholders that must never be sent to Paddle. */
const INVALID_COUNTRY_CODES = new Set([
  "XX",
  "T1",
  "ZZ",
  "A1",
  "A2",
  "O1",
  "OTHERS",
  "UNKNOWN",
  "NONE",
  "NULL",
]);

const TRUSTED_COUNTRY_HEADERS = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "cloudfront-viewer-country",
  "x-country-code",
] as const;

export function parseTrustedCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  if (INVALID_COUNTRY_CODES.has(code)) return null;
  if (code.length !== 2 || !ISO_3166_1_ALPHA_2.test(code)) return null;
  return code;
}

/**
 * Host-aware country for PricePreview.
 * If none of the trusted headers yield a real ISO country, return null
 * and let Paddle auto-detect. Never invent a country. Never pass
 * OTHERS/UNKNOWN/NONE.
 */
export function countryFromTrustedHeaders(
  headers: Headers | { get(name: string): string | null }
): string | null {
  for (const name of TRUSTED_COUNTRY_HEADERS) {
    const parsed = parseTrustedCountryCode(headers.get(name));
    if (parsed) return parsed;
  }
  return null;
}

export function paddleAddressForPreview(countryCode: string | null): { countryCode: string } | undefined {
  if (!countryCode) return undefined;
  const parsed = parseTrustedCountryCode(countryCode);
  if (!parsed) return undefined;
  return { countryCode: parsed };
}
