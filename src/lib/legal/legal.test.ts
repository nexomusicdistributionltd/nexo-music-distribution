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
import { BRAND_LEGAL_NAME, BRAND_PUBLIC_URL, BRAND_SOCIAL_LINKS, BRAND_SUPPORT_EMAIL } from "@/lib/brand/social";
import { NAV_LINKS } from "@/lib/site";
import { PADDLE_VERIFICATION_LINKS } from "./public-links";

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
  it("footer permanently links Pricing, Terms of Service, Privacy Policy, Refund Policy, and Cookies", () => {
    const footer = read("src/components/layout/Footer.tsx");
    expect(footer).toContain("PADDLE_VERIFICATION_LINKS");
    expect(footer).toContain('aria-label="Pricing and legal"');
    for (const link of PADDLE_VERIFICATION_LINKS) {
      expect(footer).toContain(`href: "${link.href}"`);
      expect(PADDLE_VERIFICATION_LINKS.some((l) => l.label === link.label)).toBe(true);
    }
    expect(PADDLE_VERIFICATION_LINKS.map((l) => l.href)).toEqual([
      "/pricing",
      "/terms",
      "/privacy",
      "/refund-policy",
      "/cookies",
    ]);
    expect(footer).not.toContain('href: "/return-policy"');
    expect(footer).toContain('from "@/components/layout/SocialLinks"');
    expect(NAV_LINKS.some((l) => l.href === "/pricing")).toBe(true);
  });

  it("canonical refund URL is /refund-policy with legacy redirect", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain('source: "/return-policy"');
    expect(cfg).toContain('destination: "/refund-policy"');
    expect(cfg).not.toMatch(/source: "\/refund-policy"[\s\S]*destination: "\/return-policy"/);
    expect(cfg).toContain('source: "/cookie-policy"');
    expect(cfg).toContain('destination: "/cookies"');
    expect(read("src/app/sitemap.ts")).toContain("/cookies");
  });

  it("cookies page ships full copy and never a CMS unpublished stub", () => {
    const cookiesPage = read("src/app/(marketing)/cookies/page.tsx");
    expect(cookiesPage).not.toMatch(/Not published yet/);
    expect(cookiesPage).toContain("COOKIES_SECTIONS");
    const cookies = flatten(COOKIES_SECTIONS);
    expect(cookiesPage).toContain("Cookies Policy");
    expect(cookies).toContain("essential");
    expect(cookies).toContain("analytics");
    expect(cookies).toContain("preference");
    expect(cookies).toContain("marketing");
    expect(cookies).toContain("nexo_otp_challenge");
    expect(cookies).toContain("does not currently load google analytics");
    expect(cookies).toContain("privacy policy");
    expect(cookies).toContain("contact@nexomusicdistro.space");
    expect(cookies).toContain("nexomusicdistribution.com");
    expect(cookies).not.toMatch(/lorem ipsum|todo|placeholder|tbd/);
  });

  it("legal copy uses company, public site, mailbox, and official social", () => {
    expect(BRAND_LEGAL_NAME).toBe("Nexo Music Distribution LTD");
    expect(BRAND_PUBLIC_URL).toBe("https://nexomusicdistribution.com");
    expect(LEGAL_CONTACT_EMAIL).toBe(BRAND_SUPPORT_EMAIL);
    expect(LEGAL_CONTACT_EMAIL).toBe("contact@nexomusicdistro.space");
    const blob = [
      flatten(TERMS_SECTIONS),
      flatten(PRIVACY_SECTIONS),
      flatten(REFUND_POLICY_SECTIONS),
      flatten(COOKIES_SECTIONS),
    ].join("\n");
    expect(blob).toContain("nexomusicdistribution.com");
    expect(blob).toContain("contact@nexomusicdistro.space");
    expect(blob).toContain("nexo music distribution ltd");
    for (const social of BRAND_SOCIAL_LINKS) {
      expect(blob).toContain(social.href.toLowerCase());
    }
    expect(blob).not.toMatch(/lorem ipsum|not published yet|\[insert|todo:|coming soon/);
    expect(blob).not.toMatch(/123 fake|lorem street|registered office: \[|acme inc/);
    expect(flatten(TERMS_SECTIONS)).toContain("do not invent those facts");
    expect(flatten(TERMS_SECTIONS)).toContain("paddle.com is the merchant of record");
    expect(flatten(PRIVACY_SECTIONS)).toContain("/cookies");
    expect(flatten(PRIVACY_SECTIONS)).toContain("does not receive or store raw payment card numbers");
    expect(flatten(REFUND_POLICY_SECTIONS)).toContain("not an absolute no-refunds policy");
    expect(flatten(REFUND_POLICY_SECTIONS)).toContain("duplicate charge");
    expect(flatten(REFUND_POLICY_SECTIONS)).toContain("unauthorised payment");
    expect(flatten(REFUND_POLICY_SECTIONS)).toContain("not an automatic refund for time already used");
    expect(flatten(TERMS_SECTIONS)).toContain("£7.99");
    expect(flatten(TERMS_SECTIONS)).toContain("ireland");
    expect(flatten(TERMS_SECTIONS)).toContain("a$14.99");
    expect(read("src/lib/legal/copy.ts")).not.toContain("NEXO MUSIC DISTRIBUTION LTD");
    expect(read("src/app/(marketing)/terms/page.tsx")).not.toContain("NEXO MUSIC DISTRIBUTION LTD");
    expect(read("src/app/(marketing)/privacy/page.tsx")).not.toContain("NEXO MUSIC DISTRIBUTION LTD");
    expect(read("src/app/(marketing)/refund-policy/page.tsx")).not.toContain(
      "NEXO MUSIC DISTRIBUTION LTD"
    );
  });

  it("pricing page shows USD catalog fallback without requiring Paddle", () => {
    const pricing = read("src/app/(marketing)/pricing/page.tsx");
    expect(pricing).toContain("Music Distribution Pricing for Artists & Labels");
    expect(pricing).toContain("BRAND_LEGAL_NAME");
    expect(pricing).toContain("BRAND_PUBLIC_URL");
    expect(pricing).not.toContain("NEXO MUSIC DISTRIBUTION LTD");
    const table = read("src/components/billing/PricingTable.tsx");
    expect(table).toContain("displayCountry");
    expect(table).toContain("formattedTotals.total");
    expect(table).toContain('"$0"');
    expect(table).toContain("PADDLE_VERIFICATION_LINKS");
    expect(table).toContain("CheckoutLegalLinks");
    expect(table).not.toMatch(/Price via Paddle checkout/);
    expect(table).not.toMatch(/Paddle catalog pending/);
    expect(table).toMatch(/DSP acceptance and income are not guaranteed/);
  });

  it("verification routes are not behind the auth wall", () => {
    const mw = read("src/middleware.ts");
    expect(mw).toContain('"/billing"');
    expect(mw).not.toMatch(/PROTECTED_PREFIXES = \[[^\]]*\/pricing/);
    expect(mw).not.toMatch(/PROTECTED_PREFIXES = \[[^\]]*\/terms/);
    expect(mw).not.toMatch(/PROTECTED_PREFIXES = \[[^\]]*\/privacy/);
    expect(mw).not.toMatch(/PROTECTED_PREFIXES = \[[^\]]*\/refund-policy/);
    expect(mw).not.toMatch(/PROTECTED_PREFIXES = \[[^\]]*\/cookies/);
  });
});
