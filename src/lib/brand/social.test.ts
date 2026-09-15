import { describe, expect, it } from "vitest";
import {
  BRAND_PUBLIC_URL,
  BRAND_SOCIAL,
  BRAND_SOCIAL_LINKS,
  BRAND_SOCIAL_NAV_LABEL,
} from "@/lib/brand/social";
import { SITE_URL } from "@/lib/site";

describe("canonical brand social constants", () => {
  it("exports Spotify, X, and TikTok URLs + aria-labels only", () => {
    expect(BRAND_SOCIAL_LINKS.map((l) => l.key)).toEqual(["spotify", "x", "tiktok"]);
    expect(BRAND_SOCIAL_LINKS).toHaveLength(3);
    expect(BRAND_SOCIAL.spotify.href).toBe(
      "https://open.spotify.com/user/31upu5jwekilb74szmimjx636p7u?si=tSYEupZZSUuTdWohaBybpg&utm_source=copy-link",
    );
    expect(BRAND_SOCIAL.x.href).toBe("https://x.com/nexomusicdistro");
    expect(BRAND_SOCIAL.tiktok.href).toBe(
      "https://www.tiktok.com/@nexomusicdistribution",
    );
    expect(BRAND_SOCIAL.spotify.ariaLabel).toBe(
      "Nexo Music Distribution on Spotify",
    );
    expect(BRAND_SOCIAL.x.ariaLabel).toBe("Nexo Music Distribution on X");
    expect(BRAND_SOCIAL.tiktok.ariaLabel).toBe(
      "Nexo Music Distribution on TikTok",
    );
    expect(BRAND_SOCIAL_NAV_LABEL).toBe("Nexo Music Distribution on social media");
  });

  it("keeps public brand URL on .com and does not treat Zoho From as a public link", () => {
    expect(BRAND_PUBLIC_URL).toBe("https://nexomusicdistribution.com");
    expect(SITE_URL).toBe(BRAND_PUBLIC_URL);
    const blob = JSON.stringify(BRAND_SOCIAL);
    expect(blob).not.toContain("nexomusicdistro.space");
    expect(blob).not.toMatch(/facebook|instagram|youtube|linkedin/i);
  });
});
