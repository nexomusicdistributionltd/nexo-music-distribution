/**
 * Canonical official social profiles for the website footer AND email HTML.
 *
 * Import path (do not duplicate URLs/aria-labels in templates):
 *   `@/lib/brand/social`
 *
 * Also re-exported from `@/lib/site` as `BRAND_SOCIAL` / `BRAND_SOCIAL_LINKS`.
 *
 * Public brand URL: https://nexomusicdistribution.com
 * Legal/business name (NexoBot): Nexo Music Distribution LTD
 * Zoho SMTP From / support mailbox: contact@nexomusicdistro.space (not a public/social URL).
 */

export const BRAND_PUBLIC_URL = "https://nexomusicdistribution.com" as const;

/** Legal/business name for public pricing and legal pages. */
export const BRAND_LEGAL_NAME = "Nexo Music Distribution LTD" as const;

export const BRAND_SUPPORT_EMAIL = "contact@nexomusicdistro.space" as const;

export const BRAND_SOCIAL_NAV_LABEL =
  "Nexo Music Distribution on social media" as const;

export type BrandSocialNetwork = "spotify" | "x" | "tiktok";

export type BrandSocialProfile = {
  key: BrandSocialNetwork;
  href: string;
  ariaLabel: string;
};

export const BRAND_SOCIAL = {
  spotify: {
    key: "spotify",
    href: "https://open.spotify.com/user/31upu5jwekilb74szmimjx636p7u?si=tSYEupZZSUuTdWohaBybpg&utm_source=copy-link",
    ariaLabel: "Nexo Music Distribution on Spotify",
  },
  x: {
    key: "x",
    href: "https://x.com/nexomusicdistro",
    ariaLabel: "Nexo Music Distribution on X",
  },
  tiktok: {
    key: "tiktok",
    href: "https://www.tiktok.com/@nexomusicdistribution",
    ariaLabel: "Nexo Music Distribution on TikTok",
  },
} as const satisfies Record<BrandSocialNetwork, BrandSocialProfile>;

/** Ordered Spotify → X → TikTok. No Facebook / Instagram / YouTube / LinkedIn. */
export const BRAND_SOCIAL_LINKS: readonly BrandSocialProfile[] = [
  BRAND_SOCIAL.spotify,
  BRAND_SOCIAL.x,
  BRAND_SOCIAL.tiktok,
];
