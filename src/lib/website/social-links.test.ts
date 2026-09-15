import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { FOOTER_SOCIAL_LINKS } from "@/lib/website/social-links";

const DESTINATIONS = {
  spotify:
    "https://open.spotify.com/user/31upu5jwekilb74szmimjx636p7u?si=tSYEupZZSUuTdWohaBybpg&utm_source=copy-link",
  x: "https://x.com/nexomusicdistro",
  tiktok: "https://www.tiktok.com/@nexomusicdistribution",
} as const;

describe("official footer social links", () => {
  it("exposes exactly Spotify, X, and TikTok — no placeholder networks", () => {
    expect(FOOTER_SOCIAL_LINKS.map((l) => l.key)).toEqual(["spotify", "x", "tiktok"]);
    expect(FOOTER_SOCIAL_LINKS).toHaveLength(3);
    for (const item of FOOTER_SOCIAL_LINKS) {
      expect(item.href).toBe(DESTINATIONS[item.key]);
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
