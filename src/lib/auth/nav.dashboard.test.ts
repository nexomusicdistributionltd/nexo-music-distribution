import { describe, expect, it } from "vitest";
import { navForRoles, navSectionsForRoles, isNavActive, workspaceKindForRoles } from "@/lib/auth/nav";
import { ddexUiStatus } from "@/lib/ddex/ui-status";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("premium dashboard nav", () => {
  it("keeps artist and label workspaces distinct", () => {
    expect(workspaceKindForRoles(["artist"])).toBe("artist");
    expect(workspaceKindForRoles(["label"])).toBe("label");
    expect(workspaceKindForRoles(["admin"])).toBe("admin");

    const artist = navForRoles(["artist"]).map((n) => n.href);
    const label = navForRoles(["label"]).map((n) => n.href);

    expect(artist).toContain("/dashboard/releases");
    expect(artist).toContain("/dashboard/artists");
    expect(artist).toContain("/earnings");
    expect(artist).toContain("/support");
    expect(artist).toContain("/analytics/streams");
    expect(artist).not.toContain("/app/artists");
    expect(artist).not.toContain("/app/artists/new");
    expect(artist).not.toContain("/admin/ddex");

    expect(artist).toContain("/dashboard/playlist-pitch");
    expect(label).toContain("/dashboard/playlist-pitch");
    expect(label).toContain("/app/artists");
    expect(label).toContain("/app/artists/new");
    expect(label).toContain("/dashboard/releases/new");
    expect(label).not.toContain("/admin/ddex");
    expect(label).toContain("/analytics/spotify-engagement");
  });

  it("shows truthful analytics destinations instead of coming-soon", () => {
    for (const role of ["artist", "label"] as const) {
      const items = navForRoles([role]);
      expect(items.some((n) => n.href === "/analytics/streams")).toBe(true);
      expect(items.some((n) => n.label === "Spotify Engagement" && n.badge === "NEW")).toBe(true);
    }
  });

  it("admin nav still covers ops destinations including DDEX", () => {
    const hrefs = navForRoles(["admin"]).map((n) => n.href);
    for (const h of [
      "/admin/releases",
      "/admin/qc",
      "/admin/artists",
      "/admin/labels",
      "/admin/roles",
      "/admin/ddex",
      "/admin/playlist-pitches",
      "/admin/marketing",
      "/admin/portal-requests",
      "/admin/distribution",
      "/admin/contact",
      "/admin/newsletter",
      "/admin/emails",
      "/admin/emails/templates",
      "/admin/emails/automated",
      "/admin/settings",
    ]) {
      expect(hrefs).toContain(h);
    }
    expect(hrefs).toContain("/admin/finance/billing");
    expect(navForRoles(["support"]).map((n) => n.href)).not.toContain("/admin/settings");
    expect(navForRoles(["support"]).map((n) => n.href)).not.toContain("/admin/marketing");
    expect(navForRoles(["support"]).map((n) => n.href)).not.toContain("/admin/roles");
    expect(navSectionsForRoles(["admin"]).length).toBeGreaterThan(4);
    expect(navForRoles(["artist"]).map((n) => n.href)).not.toContain("/admin/emails");
    expect(navForRoles(["label"]).map((n) => n.href)).not.toContain("/admin/emails");
    expect(isNavActive("/admin/emails/compose", "/admin/emails")).toBe(false);
    expect(isNavActive("/admin/emails/inbox/abc", "/admin/emails")).toBe(true);
  });

  it("treats new release as distinct from catalog list", () => {
    expect(isNavActive("/dashboard/releases/new", "/dashboard/releases")).toBe(false);
    expect(isNavActive("/dashboard/releases/new", "/dashboard/releases/new")).toBe(true);
    expect(isNavActive("/dashboard/releases/abc", "/dashboard/releases")).toBe(true);
  });
});

describe("DDEX operator statuses", () => {
  it("maps message rows without inventing DSP Connected", () => {
    expect(ddexUiStatus({})).toBe("NOT READY");
    expect(ddexUiStatus({ canGenerate: true })).toBe("READY");
    expect(
      ddexUiStatus({
        latest: { validation_status: "valid", delivery_status: "pending" },
      })
    ).toBe("NOT DELIVERED");
    expect(
      ddexUiStatus({
        latest: { validation_status: "valid", delivery_status: "delivered" },
      })
    ).toBe("VALIDATED");
    expect(
      ddexUiStatus({
        latest: { validation_status: "invalid", delivery_status: "pending" },
      })
    ).toBe("FAILED");
    expect(JSON.stringify(ddexUiStatus({ canGenerate: true }))).not.toMatch(/DSP Connected/i);
  });
});

describe("dashboard copy is truthful", () => {
  it("artist/label overview does not invent streams or revenue", () => {
    const page = readFileSync(join(__dirname, "../../app/(portal)/dashboard/page.tsx"), "utf8");
    const ui = readFileSync(join(__dirname, "../../components/portal/PortalOverview.tsx"), "utf8");
    const helpers = readFileSync(join(__dirname, "../portal/overview.ts"), "utf8");
    const src = `${page}\n${ui}\n${helpers}`;
    expect(src).not.toMatch(/fake (stream|kpi|revenue)/i);
    expect(src).toContain("Welcome back,");
    expect(src).toContain("Create release");
    expect(src).toContain("NOT CONNECTED");
    expect(src).toContain("Outstanding $0.00 is not estimated earnings");
    expect(src).not.toMatch(/Streams\s+\d+/);
  });

  it("admin overview is attention-first without fabricated DSP connections", () => {
    const src = readFileSync(join(__dirname, "../../app/admin/page.tsx"), "utf8");
    expect(src).toContain("Administration command center");
    expect(src).not.toMatch(/DSP Connected/);
    expect(src).toContain("getAdminAttention");
    expect(src).toContain("Authoritative database counts.");
  });
});
