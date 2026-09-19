import { describe, expect, it } from "vitest";
import { adminBillingCatalog } from "@/lib/billing/admin-catalog";
import { PRIMARY_CONTACT_EMAIL, INQUIRIES_EMAIL, isBrandedFromAddress } from "@/lib/brand/contact";
import { contactReplyBodyHtml, brandedHtmlFromShellOrFallback } from "@/lib/email/branded-html";
import { buildNewsletterHtml } from "@/lib/email/newsletter-html";

describe("admin billing catalog visibility", () => {
  it("shows starter/pro amounts and trials without leaking price ids", () => {
    const catalog = adminBillingCatalog({ NODE_ENV: "test",} as NodeJS.ProcessEnv);
    expect(catalog.rows.map((r) => r.id)).toEqual([
      "artist_starter",
      "artist_pro",
      "label_starter",
      "label_pro",
    ]);
    const starter = catalog.rows.find((r) => r.id === "artist_starter");
    expect(starter?.amounts.month).toBe("Free");
    expect(starter?.trialDays).toBeNull();
    const pro = catalog.rows.find((r) => r.id === "artist_pro");
    expect(pro?.amounts.month).toBe("$9.99");
    expect(pro?.trialDays).toBe(7);
    expect(pro?.priceIdPresent.month).toBe(false);
    expect(JSON.stringify(catalog)).not.toMatch(/pri_/);
    expect(JSON.stringify(catalog)).not.toMatch(/pdl_/);
  });

  it("marks price id presence from env names only", () => {
    const catalog = adminBillingCatalog({ NODE_ENV: "test",
      PADDLE_PRICE_ARTIST_PRO_MONTHLY: "pri_secret",
    } as NodeJS.ProcessEnv);
    const pro = catalog.rows.find((r) => r.id === "artist_pro");
    expect(pro?.priceIdPresent.month).toBe(true);
    expect(pro?.priceIdPresent.year).toBe(false);
    expect(JSON.stringify(catalog)).not.toContain("pri_secret");
  });
});

describe("public contact mailboxes", () => {
  it("uses branded public support mailboxes and branded from domains", () => {
    expect(PRIMARY_CONTACT_EMAIL).toBe("support@nexomusicdistribution.com");
    expect(INQUIRIES_EMAIL).toBe("support@nexomusicdistribution.com");
    expect(isBrandedFromAddress("Nexo <contact@nexomusicdistro.space>")).toBe(true);
    expect(isBrandedFromAddress("ops@nexomusicdistribution.com")).toBe(true);
    expect(isBrandedFromAddress("other@gmail.com")).toBe(false);
  });
});

describe("branded contact reply + newsletter preview shell", () => {
  it("wraps visitor replies in Nexo branded HTML", () => {
    const body = contactReplyBodyHtml({
      visitorName: "Ada",
      originalSubject: "Hello",
      originalMessage: "Please help",
      replyBody: "We got this.",
    });
    const html = brandedHtmlFromShellOrFallback(null, { subject: "Re: Hello", bodyHtml: body });
    expect(html).toContain("We got this.");
    expect(html).toContain("Please help");
    expect(html).toContain("nexomusicdistribution.com");
    expect(html).toContain("Nexo");
  });

  it("newsletter preview matches send shell colors and logo", () => {
    const html = buildNewsletterHtml({
      subject: "Weekly",
      bodyHtml: "<p>Hi</p>",
      unsubscribeUrl: "https://nexomusicdistribution.com/newsletter/unsubscribe?token=x",
    });
    expect(html).toContain("nexo-icon-light");
    expect(html).toContain("#0a0a0a");
    expect(html).toContain("<p>Hi</p>");
  });
});
