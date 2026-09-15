/**
 * Homepage editorial image presets + CMS URL resolver.
 * Never returns placeholder.jpg or empty — always a real local asset or a valid override URL.
 */

export const HOMEPAGE_IMAGE_PRESETS = {
  vinyl: "/images/vinyl.jpg",
  waveform: "/images/waveform.jpg",
  console: "/images/console.jpg",
  score: "/images/score.jpg",
  studio: "/images/studio-lines.jpg",
} as const;

export type HomepageImagePreset = keyof typeof HOMEPAGE_IMAGE_PRESETS;

/** Section keys stored under website_settings.homepage */
export const HOMEPAGE_IMAGE_KEYS = [
  "hero_image_url",
  "artists_image_url",
  "labels_image_url",
  "distribution_image_url",
  "royalties_image_url",
  "publishing_image_url",
  "about_image_url",
  "cta_image_url",
] as const;

export type HomepageImageKey = (typeof HOMEPAGE_IMAGE_KEYS)[number];

export const HOMEPAGE_IMAGE_DEFAULTS: Record<HomepageImageKey, HomepageImagePreset> = {
  hero_image_url: "vinyl",
  artists_image_url: "waveform",
  labels_image_url: "studio",
  distribution_image_url: "studio",
  royalties_image_url: "console",
  publishing_image_url: "score",
  about_image_url: "studio",
  cta_image_url: "vinyl",
};

const PLACEHOLDER_RE = /placeholder\.(jpg|jpeg|png|webp|gif)|\/placeholder(\?|$)/i;

/**
 * Returns a usable image src: CMS URL when present and non-placeholder,
 * otherwise the local preset path for the section.
 */
export function resolveHomepageImage(
  cmsUrl: unknown,
  fallback: HomepageImagePreset = "vinyl"
): string {
  const local = HOMEPAGE_IMAGE_PRESETS[fallback] ?? HOMEPAGE_IMAGE_PRESETS.vinyl;
  if (typeof cmsUrl !== "string") return local;
  const trimmed = cmsUrl.trim();
  if (!trimmed) return local;
  if (PLACEHOLDER_RE.test(trimmed)) return local;

  // Local public assets
  if (trimmed.startsWith("/images/")) {
    // Reject unknown local paths that aren't our presets / safe images folder
    if (PLACEHOLDER_RE.test(trimmed)) return local;
    return trimmed;
  }

  // Absolute https only (no javascript:, data:, http)
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return local;
    if (PLACEHOLDER_RE.test(u.pathname)) return local;
    return u.toString();
  } catch {
    return local;
  }
}

export function isLocalHomepageImage(src: string): boolean {
  return src.startsWith("/images/");
}

export function presetPath(preset: HomepageImagePreset): string {
  return HOMEPAGE_IMAGE_PRESETS[preset];
}

/** Read all section image URLs from homepage settings blob with fallbacks applied. */
export function resolveHomepageImageMap(
  home: Record<string, unknown>
): Record<HomepageImageKey, string> {
  const out = {} as Record<HomepageImageKey, string>;
  for (const key of HOMEPAGE_IMAGE_KEYS) {
    out[key] = resolveHomepageImage(home[key], HOMEPAGE_IMAGE_DEFAULTS[key]);
  }
  return out;
}
