/**
 * Public HTTPS brand assets for outbound email.
 * Website + social URLs come from `@/lib/website/social-links` (href/label sourced
 * from `@/lib/brand/social` — do not duplicate Spotify/X/TikTok constants here).
 * Mailbox (Zoho SMTP From / support mailto): contact@nexomusicdistro.space
 * Never use relative /public paths in messages — clients cannot fetch them.
 */
import { SITE_URL } from "@/lib/site";
import { FOOTER_SOCIAL_LINKS } from "@/lib/website/social-links";

const socialByKey = Object.fromEntries(
  FOOTER_SOCIAL_LINKS.map((item) => [item.key, item]),
) as {
  [K in (typeof FOOTER_SOCIAL_LINKS)[number]["key"]]: (typeof FOOTER_SOCIAL_LINKS)[number];
};

const JSDELIVR_EMAIL_ICON = (file: string) =>
  `https://cdn.jsdelivr.net/gh/nexomusicdistributionltd/nexo-music-distribution@main/public/brand/email/${file}`;

export const NEXO_EMAIL_BRAND = {
  website: SITE_URL,
  email: "contact@nexomusicdistro.space",
  company: "Nexo Music Distribution LTD",
  tagline: "Digital Music Distribution | Publishing | Royalty Management",
  /** Silver wordmark on transparent (CloudFront). */
  wordmark:
    "https://d2ol7oe51mr4n9.cloudfront.net/user_3J50bnYm6p1zfDNZ4mvIkqNfXgQ/5d2343c0-6c83-4277-855d-696ffca77790.png",
  /** Light icon for dark fields. */
  iconLight: "https://nexomusicdistribution.com/brand/email/nexo-icon-light-v2.png",
  socials: {
    spotify: socialByKey.spotify.href,
    x: socialByKey.x.href,
    tiktok: socialByKey.tiktok.href,
  },
  icons: {
    spotifyWhite: JSDELIVR_EMAIL_ICON("icon-spotify-white.png"),
    xWhite: JSDELIVR_EMAIL_ICON("icon-x-white.png"),
    /** Existing CloudFront white TikTok glyph. */
    tiktokWhite:
      "https://d2ol7oe51mr4n9.cloudfront.net/user_3J50bnYm6p1zfDNZ4mvIkqNfXgQ/ab90abbb-2019-4161-877c-b2cbb0b92826.png",
    globeWhite:
      "https://d2ol7oe51mr4n9.cloudfront.net/user_3J50bnYm6p1zfDNZ4mvIkqNfXgQ/a46131aa-a854-42f5-b65d-358571cea2fd.png",
    mailWhite:
      "https://d2ol7oe51mr4n9.cloudfront.net/user_3J50bnYm6p1zfDNZ4mvIkqNfXgQ/0a190c12-e78c-4f1c-a230-aead6a8ced17.png",
  },
} as const;

export const NEXO_EMAIL_SHELL_PATH = "emails/shells/nexo-dark.html";

const ICON_BY_KEY = {
  spotify: NEXO_EMAIL_BRAND.icons.spotifyWhite,
  x: NEXO_EMAIL_BRAND.icons.xWhite,
  tiktok: NEXO_EMAIL_BRAND.icons.tiktokWhite,
} as const;

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Centered Spotify / X / TikTok icon row for branded email footers. */
export function emailSocialIconsRowHtml(): string {
  const cells = FOOTER_SOCIAL_LINKS.map(
    (item) => `<td align="center" style="padding:0 10px;">
                            <a href="${escapeAttr(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(item.label)}" style="text-decoration:none;">
                              <img src="${escapeAttr(ICON_BY_KEY[item.key])}" width="22" height="22" alt="${escapeAttr(item.label)}" style="display:block;border:0;outline:none;width:22px;height:22px;" />
                            </a>
                          </td>`,
  ).join("\n                          ");
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
                        <tr>
                          ${cells}
                        </tr>
                      </table>`;
}
