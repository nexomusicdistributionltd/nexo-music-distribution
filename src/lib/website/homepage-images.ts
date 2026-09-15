/**
 * Homepage editorial image presets + CMS URL resolver.
 * Never returns placeholder.jpg or empty — always a real local asset or a valid override URL.
 * Prefer human/music editorial presets over abstract vinyl-only defaults.
 */

export const HOMEPAGE_IMAGE_PRESETS = {
  vinyl: "/images/vinyl.jpg",
  waveform: "/images/waveform.jpg",
  console: "/images/console.jpg",
  score: "/images/score.jpg",
  studio: "/images/studio-lines.jpg",
  /** Real Unsplash — singer at microphone */
  singer: "/images/editorial/singer-microphone.jpg",
  /** Real Unsplash — studio session / guitars */
  studioSession: "/images/editorial/studio-session.jpg",
  /** Real Unsplash — studio / producer atmosphere */
  producer: "/images/editorial/producer-console.jpg",
  /** Real Unsplash — live performance */
  live: "/images/editorial/live-performance.jpg",
  /** Real Unsplash — headphones / creative */
  headphones: "/images/editorial/headphones-creative.jpg",
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

/** Prefer editorial human/music photography over abstract vinyl-only. */
export const HOMEPAGE_IMAGE_DEFAULTS: Record<HomepageImageKey, HomepageImagePreset> = {
  hero_image_url: "singer",
  artists_image_url: "live",
  labels_image_url: "studioSession",
  distribution_image_url: "producer",
  royalties_image_url: "producer",
  publishing_image_url: "headphones",
  about_image_url: "studioSession",
  cta_image_url: "live",
};

const PLACEHOLDER_RE = /placeholder\.(jpg|jpeg|png|webp|gif)|\/placeholder(\?|$)/i;

/**
 * Returns a usable image src: CMS URL when present and non-placeholder,
 * otherwise the local preset path for the section.
 */
export function resolveHomepageImage(
  cmsUrl: unknown,
  fallback: HomepageImagePreset = "singer"
): string {
  const local = HOMEPAGE_IMAGE_PRESETS[fallback] ?? HOMEPAGE_IMAGE_PRESETS.singer;
  if (typeof cmsUrl !== "string") return local;
  const trimmed = cmsUrl.trim();
  if (!trimmed) return local;
  if (PLACEHOLDER_RE.test(trimmed)) return local;

  // Local public assets
  if (trimmed.startsWith("/images/")) {
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

/** Editorial attribution path (must exist in repo). */
export const EDITORIAL_ATTRIBUTION_PATH = "/images/editorial/ATTRIBUTION.md";

export function editorialImagePaths(): string[] {
  return [
    HOMEPAGE_IMAGE_PRESETS.singer,
    HOMEPAGE_IMAGE_PRESETS.studioSession,
    HOMEPAGE_IMAGE_PRESETS.producer,
    HOMEPAGE_IMAGE_PRESETS.live,
    HOMEPAGE_IMAGE_PRESETS.headphones,
  ];
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
