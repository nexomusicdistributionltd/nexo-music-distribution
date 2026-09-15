import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FOOTER_SOCIAL_LINKS } from "@/lib/website/social-links";
import { NEXO_EMAIL_BRAND, emailSocialIconsRowHtml } from "./brand";

const ROOT = join(process.cwd());

const HTML_DIRS = [
  join(ROOT, "emails/templates"),
  join(ROOT, "emails/shells"),
  join(ROOT, "emails/fragments"),
  join(ROOT, "supabase/templates"),
];

function htmlHref(url: string): string {
  return url.replace(/&/g, "&amp;");
}

const FAKE_SOCIAL = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "youtube-nocookie.com",
];

function walkHtml(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkHtml(full));
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

describe("email brand constants", () => {
  it("points public website at nexomusicdistribution.com and keeps the Zoho mailbox", () => {
    expect(NEXO_EMAIL_BRAND.website).toBe("https://nexomusicdistribution.com");
    expect(NEXO_EMAIL_BRAND.email).toBe("contact@nexomusicdistro.space");
    expect(FOOTER_SOCIAL_LINKS.map((l) => l.key)).toEqual(["spotify", "x", "tiktok"]);
    for (const item of FOOTER_SOCIAL_LINKS) {
      expect(NEXO_EMAIL_BRAND.socials[item.key]).toBe(item.href);
    }
  });

  it("keeps logo-urls (emails/brand.json) aligned with TypeScript constants", () => {
    const json = JSON.parse(
      readFileSync(join(ROOT, "emails/brand.json"), "utf8"),
    ) as {
      website: string;
      email: string;
      spotify: string;
      x: string;
      tiktok: string;
      icon: string;
      icon_light: string;
      icons: Record<string, string>;
    };
    expect(json.website).toBe(NEXO_EMAIL_BRAND.website);
    expect(json.email).toBe(NEXO_EMAIL_BRAND.email);
    expect(json.spotify).toBe(NEXO_EMAIL_BRAND.socials.spotify);
    expect(json.x).toBe(NEXO_EMAIL_BRAND.socials.x);
    expect(json.tiktok).toBe(NEXO_EMAIL_BRAND.socials.tiktok);
    expect(json.icon).toBe(NEXO_EMAIL_BRAND.iconLight);
    expect(json.icon_light).toBe(NEXO_EMAIL_BRAND.iconLight);
    expect(json.icons.spotify_white).toBe(NEXO_EMAIL_BRAND.icons.spotifyWhite);
    expect(json.icons.x_white).toBe(NEXO_EMAIL_BRAND.icons.xWhite);
    expect(json.icons.tiktok_white).toBe(NEXO_EMAIL_BRAND.icons.tiktokWhite);
    expect(json.icons.spotify_white).toContain(
      "nexo-music-distribution@main/public/brand/email/icon-spotify-white.png",
    );
    expect(json.icons.x_white).toContain(
      "nexo-music-distribution@main/public/brand/email/icon-x-white.png",
    );
    const logoUrls = readFileSync(join(ROOT, "emails/logo-urls.json"), "utf8");
    expect(logoUrls).toBe(readFileSync(join(ROOT, "emails/brand.json"), "utf8"));
  });

  it("emits Spotify/X/TikTok icons with new-tab + noopener", () => {
    const html = emailSocialIconsRowHtml();
    for (const item of FOOTER_SOCIAL_LINKS) {
      expect(html).toContain(`aria-label="${item.label}"`);
      expect(html).toContain(`href="${htmlHref(item.href)}"`);
    }
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toMatch(/facebook|instagram|linkedin|youtube\.com/i);
  });
});

describe("branded email HTML pack", () => {
  const files = HTML_DIRS.flatMap(walkHtml);

  it("loads templates, shells, fragments, and supabase auth emails", () => {
    expect(files.some((f) => f.includes("emails/templates/"))).toBe(true);
    expect(files.some((f) => f.includes("emails/shells/nexo-dark.html"))).toBe(
      true,
    );
    expect(files.some((f) => f.includes("supabase/templates/confirmation.html"))).toBe(
      true,
    );
  });

  it("uses the public website host, not nexomusicdistro.space, for http(s) links", () => {
    for (const file of files) {
      const html = readFileSync(file, "utf8");
      const httpsHits = [
        ...html.matchAll(/https:\/\/nexomusicdistro\.space[^\s"'<]*/g),
      ];
      expect(httpsHits, file).toEqual([]);
      const websiteHrefs = [
        ...html.matchAll(/href="(https:\/\/nexomusicdistribution\.com[^"]*)"/g),
      ];
      if (file.includes("/fragments/custom-default-body.html")) continue;
      if (websiteHrefs.length === 0 && !file.includes("/fragments/")) {
        expect(html, file).toContain("https://nexomusicdistribution.com");
      }
    }
  });

  it("keeps the Zoho mailbox for support mailto", () => {
    const withFooter = files.filter(
      (f) =>
        !f.includes("/fragments/") &&
        readFileSync(f, "utf8").includes("Nexo Music Distribution LTD"),
    );
    expect(withFooter.length).toBeGreaterThan(10);
    for (const file of withFooter) {
      const html = readFileSync(file, "utf8");
      expect(html, file).toContain("mailto:contact@nexomusicdistro.space");
      expect(html, file).toContain("contact@nexomusicdistro.space");
    }
  });

  it("uses only official Spotify/X/TikTok socials in footers, with new-tab + aria-labels", () => {
    const spotifyLabel = FOOTER_SOCIAL_LINKS.find((l) => l.key === "spotify")?.label;
    const withSocial = files.filter((f) =>
      readFileSync(f, "utf8").includes(spotifyLabel ?? ""),
    );
    expect(withSocial.length).toBeGreaterThan(10);
    for (const file of withSocial) {
      const html = readFileSync(file, "utf8");
      for (const item of FOOTER_SOCIAL_LINKS) {
        expect(html, file).toContain(`href="${htmlHref(item.href)}"`);
        expect(html, file).toContain(`aria-label="${item.label}"`);
      }
      const socialAnchors = [
        ...html.matchAll(
          /<a href="(https:\/\/(?:open\.spotify\.com|x\.com|www\.tiktok\.com)[^"]*)"[^>]*>/g,
        ),
      ];
      expect(socialAnchors.length, file).toBeGreaterThanOrEqual(3);
      for (const m of socialAnchors) {
        const tag = m[0];
        expect(tag, file).toContain('target="_blank"');
        expect(tag, file).toContain('rel="noopener noreferrer"');
      }
      for (const fake of FAKE_SOCIAL) {
        expect(html.toLowerCase(), file).not.toContain(fake);
      }
    }
  });
});
