import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COOKIES_SECTIONS,
  LEGAL_CONTACT_EMAIL,
  PRIVACY_SECTIONS,
  REFUND_POLICY_SECTIONS,
  TERMS_SECTIONS,
} from "./copy";
import { BRAND_PUBLIC_URL, BRAND_SOCIAL_LINKS } from "@/lib/brand/social";
import { COMPANY_LEGAL, NAV_LINKS } from "@/lib/site";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function flatten(sections: { paragraphs: string[]; bullets?: string[] }[]) {
  return sections
    .flatMap((s) => [...s.paragraphs, ...(s.bullets ?? [])])
    .join("\n")
    .toLowerCase();
}

describe("public legal and pricing pages", () => {
  it("footer and nav link the five publishable URLs", () => {
    const footer = read("src/components/layout/Footer.tsx");
    expect(footer).toContain('href: "/pricing"');
    expect(footer).toContain('href: "/terms"');
    expect(footer).toContain('href: "/privacy"');
    expect(footer).toContain('href: "/refund-policy"');
    expect(footer).toContain('href: "/cookies"');
    expect(footer).not.toContain('href: "/return-policy"');
    expect(NAV_LINKS.some((l) => l.href === "/pricing")).toBe(true);
  });

  it("canonical refund URL is /refund-policy with legacy redirect", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain('source: "/return-policy"');
    expect(cfg).toContain('destination: "/refund-policy"');
    expect(cfg).not.toMatch(/source: "\/refund-policy"[\s\S]*destination: "\/return-policy"/);
    expect(read("src/app/sitemap.ts")).toContain("/refund-policy");
  });

  it("cookies page ships full copy and never a CMS unpublished stub", () => {
    const cookiesPage = read("src/app/(marketing)/cookies/page.tsx");
    expect(cookiesPage).not.toMatch(/Not published yet/);
    expect(cookiesPage).toContain("COOKIES_SECTIONS");
    const cookies = flatten(COOKIES_SECTIONS);
    expect(cookies).toContain("essential");
    expect(cookies).toContain("paddle");
    expect(cookies).not.toMatch(/lorem ipsum|todo|placeholder|tbd/);
  });

  it("legal copy uses company, public site, mailbox, and official social", () => {
    expect(COMPANY_LEGAL).toBe("NEXO MUSIC DISTRIBUTION LTD");
    expect(BRAND_PUBLIC_URL).toBe("https://nexomusicdistribution.com");
    expect(LEGAL_CONTACT_EMAIL).toBe("support@nexomusicdistribution.com");
    const blob = [
      flatten(TERMS_SECTIONS),
      flatten(PRIVACY_SECTIONS),
      flatten(REFUND_POLICY_SECTIONS),
      flatten(COOKIES_SECTIONS),
    ].join("\n");
    expect(blob).toContain("nexomusicdistribution.com");
    expect(blob).toContain("support@nexomusicdistribution.com");
    expect(blob).not.toContain("nexomusicdistribution@gmail.com");
    expect(blob).toContain("nexo music distribution ltd");
    for (const social of BRAND_SOCIAL_LINKS) {
      expect(blob).toContain(social.href.toLowerCase());
    }
    expect(blob).not.toMatch(/lorem ipsum|not published yet|\[insert|todo:|coming soon/);
  });

  it("pricing page shows USD catalog fallback without requiring Paddle", () => {
    const pricing = read("src/app/(marketing)/pricing/page.tsx");
    expect(pricing).toContain("Music Distribution Pricing for Artists & Labels");
    expect(pricing).toContain("$9.99");
    const table = read("src/components/billing/PricingTable.tsx");
    expect(table).toContain("displayUsd");
    expect(table).toContain("formattedTotals.total");
    expect(table).not.toMatch(/Price via Paddle checkout/);
    expect(table).not.toMatch(/Paddle catalog pending/);
  });
});
