import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { BRAND_SOCIAL, BRAND_SOCIAL_LINKS } from "@/lib/brand/social";
import { FOOTER_SOCIAL_LINKS } from "@/lib/website/social-links";
import { BRAND_SOCIAL as SITE_BRAND_SOCIAL } from "@/lib/site";

const DESTINATIONS = {
  spotify: BRAND_SOCIAL.spotify.href,
  x: BRAND_SOCIAL.x.href,
  tiktok: BRAND_SOCIAL.tiktok.href,
} as const;

describe("official footer social links", () => {
  it("exposes exactly Spotify, X, and TikTok — no placeholder networks", () => {
    expect(FOOTER_SOCIAL_LINKS.map((l) => l.key)).toEqual(["spotify", "x", "tiktok"]);
    expect(FOOTER_SOCIAL_LINKS).toHaveLength(3);
    expect(FOOTER_SOCIAL_LINKS.map((l) => l.href)).toEqual(
      BRAND_SOCIAL_LINKS.map((l) => l.href),
    );
    expect(SITE_BRAND_SOCIAL).toBe(BRAND_SOCIAL);
    for (const item of FOOTER_SOCIAL_LINKS) {
      expect(item.href).toBe(DESTINATIONS[item.key]);
      expect(item.label).toBe(BRAND_SOCIAL[item.key].ariaLabel);
    }
  });

  it("renders professional icon links with a11y + safe new-tab attributes", () => {
    const html = renderToStaticMarkup(createElement(SocialLinks));
    expect(html).toContain('aria-label="Nexo Music Distribution on social media"');
    expect(html).toContain('aria-label="Nexo Music Distribution on Spotify"');
    expect(html).toContain('aria-label="Nexo Music Distribution on X"');
    expect(html).toContain('aria-label="Nexo Music Distribution on TikTok"');
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) =>
      m[1].replaceAll("&amp;", "&"),
    );
    expect(hrefs).toEqual([DESTINATIONS.spotify, DESTINATIONS.x, DESTINATIONS.tiktok]);
    expect(html.match(/target="_blank"/g)?.length).toBe(3);
    expect(html.match(/rel="noopener noreferrer"/g)?.length).toBe(3);
    expect(html).not.toMatch(/facebook|instagram|youtube|linkedin/i);
    expect(html).not.toContain("nexomusicdistro.space");
  });
});
