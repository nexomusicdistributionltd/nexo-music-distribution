import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FORBIDDEN_PORTAL_COPY,
  accountOverlayItems,
  generatedPortalHrefs,
  findPortalItem,
  portalSectionsForKind,
} from "@/lib/portal/ia";
import { allKnowledgeArticles } from "@/lib/portal/knowledge";
import {
  validateMemberInput,
  validatePayeeInput,
  validatePayoutRequestInput,
  validateServiceRequestInput,
  validateSplitCreateInput,
  validateVideoInput,
} from "@/lib/portal/validate";
import { PORTAL_SERVICE_KINDS } from "@/lib/portal/service-kinds";

describe("portal IA", () => {
  it("exposes complete portal accordion sections for artist and label", () => {
    for (const kind of ["artist", "label"] as const) {
      const sections = portalSectionsForKind(kind);
      expect(sections.map((s) => s.id)).toEqual([
        "catalog",
        "marketing",
        "sales",
        "analytics",
        "reports",
        "royalties",
        "splitshare",
        "rights",
        "help",
      ]);
      expect(sections.map((s) => s.label)).toEqual([
        "Catalog",
        "Marketing",
        "Sales",
        "Analytics",
        "Reports",
        "Royalties",
        "SplitShare",
        "Rights",
        "Help",
      ]);
    }
  });

  it("keeps label roster extras off the artist accordion", () => {
    const artist = portalSectionsForKind("artist").flatMap((s) => s.items).map((i) => i.href);
    const label = portalSectionsForKind("label").flatMap((s) => s.items).map((i) => i.href);
    expect(artist).not.toContain("/app/artists");
    expect(artist).not.toContain("/app/artists/new");
    expect(artist).toContain("/dashboard/artists");
    expect(label).toContain("/app/artists");
    expect(label).toContain("/app/artists/new");
    expect(label).not.toContain("/dashboard/artists");
  });

  it("lands catalog actions on real Nexo routes", () => {
    const hrefs = portalSectionsForKind("label").flatMap((s) => s.items).map((i) => i.href);
    expect(hrefs).toContain("/dashboard/releases");
    expect(hrefs).toContain("/dashboard/releases/new");
    expect(hrefs).toContain("/dashboard/videos");
    expect(hrefs).toContain("/dashboard/catalog/move-in");
    expect(hrefs).toContain("/dashboard/playlist-pitch");
    expect(hrefs).toContain("/earnings");
    expect(hrefs).toContain("/earnings/payouts");
    expect(hrefs).toContain("/sales");
    expect(hrefs).toContain("/sales/monthly-overviews");
    expect(hrefs).toContain("/reports");
    expect(hrefs).toContain("/reports/raw-data");
    expect(hrefs).toContain("/support");
  });

  it("marks Spotify Engagement as NEW and uses Nexo names", () => {
    const marketing = portalSectionsForKind("artist").find((s) => s.id === "marketing")!;
    const labels = marketing.items.map((i) => i.label);
    expect(labels).toContain("Nexo Ad Box");
    expect(labels).toContain("Nexo Labs");
    expect(labels).toContain("Playlist pitching");
    expect(labels.join(" ")).not.toMatch(/Symphonic/i);
    const engagement = portalSectionsForKind("artist")
      .find((s) => s.id === "analytics")!
      .items.find((i) => i.href === "/analytics/spotify-engagement");
    expect(engagement?.badge).toBe("NEW");
  });

  it("account overlay covers payment, members, enrollments, labels, profile", () => {
    const items = accountOverlayItems("label").map((i) => i.label);
    expect(items).toEqual([
      "Payment & Tax Details",
      "Account Members",
      "Enrollments",
      "Labels",
      "My profile",
    ]);
  });

  it("generated pages have unique hrefs", () => {
    const hrefs = generatedPortalHrefs();
    expect(hrefs.length).toBe(new Set(hrefs).size);
    expect(hrefs).toContain("/catalog/ringtone");
    expect(hrefs).toContain("/analytics/streams");
    expect(hrefs).toContain("/account/payment-tax");
    for (const href of hrefs) {
      expect(findPortalItem(href)?.href).toBe(href);
    }
  });
});

describe("portal copy is Nexo-only", () => {
  it("does not include Symphonic product names", () => {
    const files = [
      join(__dirname, "knowledge.ts"),
      join(__dirname, "../auth/nav.ts"),
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const bad of FORBIDDEN_PORTAL_COPY) {
        expect(src).not.toContain(bad);
      }
    }
    for (const article of allKnowledgeArticles()) {
      const blob = `${article.title} ${article.summary} ${article.sections.map((s) => s.body).join(" ")}`;
      for (const bad of FORBIDDEN_PORTAL_COPY) {
        expect(blob).not.toContain(bad);
      }
    }
  });
});

describe("portal validators", () => {
  it("accepts known service kinds and http urls", () => {
    expect(PORTAL_SERVICE_KINDS.length).toBeGreaterThan(10);
    const ok = validateServiceRequestInput({
      kind: "ringtone",
      title: "Cut from Track A",
      related_url: "https://nexomusicdistribution.com/r",
    });
    expect(ok.ok).toBe(true);
    expect(validateServiceRequestInput({ kind: "nope", title: "x" }).ok).toBe(false);
    expect(validateVideoInput({ title: "MV", video_url: "https://youtube.com/watch?v=1" }).ok).toBe(true);
    expect(validateVideoInput({ title: "MV", video_url: "javascript:alert(1)" }).ok).toBe(false);
    expect(validatePayeeInput({ name: "Ada" }).ok).toBe(true);
    expect(validateMemberInput({ email: "a@b.co" }).ok).toBe(true);
    expect(validatePayoutRequestInput({ amountMinor: 500 }).ok).toBe(true);
    expect(validatePayoutRequestInput({ amountMinor: 0 }).ok).toBe(false);
    const split = validateSplitCreateInput({
      name: "Default",
      shares: [{ partyName: "Ada", partyRole: "artist", shareBps: 10000 }],
    });
    expect(split.ok).toBe(true);
  });
});
