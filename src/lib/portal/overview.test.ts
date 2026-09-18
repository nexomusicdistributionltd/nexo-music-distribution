import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FORBIDDEN_PORTAL_COPY, portalSectionsForKind } from "@/lib/portal/ia";
import { ENROLLABLE_SERVICES } from "@/lib/portal/service-kinds";
import {
  OVERVIEW_HREFS,
  buildBalanceOverview,
  streamOverviewHeadline,
  streamOverviewRows,
  unenrolledServiceCount,
} from "@/lib/portal/overview";

describe("portal overview streams", () => {
  it("lists all core DSPs as connected without inventing play counts", () => {
    const rows = streamOverviewRows([]);
    expect(rows.every((r) => r.status === "CONNECTED")).toBe(true);
    expect(rows.every((r) => r.statementRows === 0)).toBe(true);
    expect(rows.map((r) => r.label)).toContain("Spotify");
    expect(rows.map((r) => r.label)).toContain("Apple Music");
    expect(JSON.stringify(rows)).not.toMatch(/"statementRows":[1-9]/);
  });

  it("marks matching ingested DSP codes LIVE using statement rows only", () => {
    const rows = streamOverviewRows(["spotify", "SPOTIFY", "unknown_dsp"]);
    const spotify = rows.find((r) => r.id === "spotify")!;
    expect(spotify.status).toBe("LIVE");
    expect(spotify.statementRows).toBe(2);
    expect(rows.find((r) => r.id === "apple_music")?.status).toBe("CONNECTED");
    expect(rows.some((r) => r.id === "unknown_dsp" && r.status === "LIVE")).toBe(true);
  });

  it("shows only verified provider trend percentages", () => {
    const rows = streamOverviewRows(
      ["spotify", "apple_music"],
      "CONNECTED",
      { spotify: 1250 },
      { spotify: 8.25, apple_music: -2.5 }
    );
    expect(rows.find((r) => r.id === "spotify")?.trendPercent).toBe(8.25);
    expect(rows.find((r) => r.id === "apple_music")?.trendPercent).toBe(-2.5);
    expect(rows.find((r) => r.id === "youtube")?.trendPercent).toBeNull();

    const ambiguous = streamOverviewRows(
      ["apple_music", "apple"],
      "CONNECTED",
      {},
      { apple_music: 3, apple: 4 }
    );
    expect(ambiguous.find((r) => r.id === "apple_music")?.trendPercent).toBeNull();
  });

  it("uses unavailable/connected copy without fake values", () => {
    const empty = streamOverviewHeadline({ connected: false, rowCount: 0 });
    expect(empty.status).toBe("UNAVAILABLE");
    expect(empty.chartNote).toMatch(/temporarily unavailable/i);
    expect(empty.chartNote).not.toMatch(/\b\d{2,}\b/);
    const live = streamOverviewHeadline({ connected: true, rowCount: 3 });
    expect(live.status).toBe("LIVE");
    expect(live.chartNote).toMatch(/reported stream\/play metrics/i);
  });
});

describe("portal overview balance", () => {
  it("shows truthful $0 outstanding when no ledger exists", () => {
    const empty = buildBalanceOverview({ statement: null, ledger: null });
    expect(empty.hasLedgerData).toBe(false);
    expect(empty.outstandingMinor).toBe(0);
    expect(empty.earningsMinor).toBeNull();
    expect(empty.note).toMatch(/not estimated earnings/i);
  });

  it("maps statement fields without inventing opening/earnings", () => {
    const fromStatement = buildBalanceOverview({
      statement: {
        currency: "usd",
        period_end: "2026-06-30",
        opening_minor: 100,
        earnings_minor: 250,
        adjustments_minor: 0,
        payouts_minor: 50,
        closing_minor: 300,
      },
      ledger: null,
    });
    expect(fromStatement.hasLedgerData).toBe(true);
    expect(fromStatement.outstandingMinor).toBe(300);
    expect(fromStatement.earningsMinor).toBe(250);
    expect(fromStatement.paymentsMinor).toBe(50);

    const fromLedger = buildBalanceOverview({
      statement: null,
      ledger: { currency: "GBP", available_minor: 1200, pending_minor: 40, paid_minor: 800 },
    });
    expect(fromLedger.currency).toBe("GBP");
    expect(fromLedger.outstandingMinor).toBe(1200);
    expect(fromLedger.paymentsMinor).toBe(800);
    expect(fromLedger.earningsMinor).toBeNull();
  });
});

describe("portal overview enrollments and routes", () => {
  it("counts unenrolled services from real rows only", () => {
    expect(unenrolledServiceCount(ENROLLABLE_SERVICES.length, [])).toBe(ENROLLABLE_SERVICES.length);
    expect(unenrolledServiceCount(6, ["ad_box", "sync"])).toBe(4);
    expect(streamOverviewRows([], "UNAVAILABLE").every((r) => r.status === "UNAVAILABLE")).toBe(true);
  });

  it("wires home CTAs to existing IA routes", () => {
    const hrefs = portalSectionsForKind("label").flatMap((s) => s.items).map((i) => i.href);
    expect(hrefs).toContain(OVERVIEW_HREFS.releases);
    expect(hrefs).toContain(OVERVIEW_HREFS.createRelease);
    expect(hrefs).toContain(OVERVIEW_HREFS.videos);
    expect(hrefs).toContain(OVERVIEW_HREFS.streams);
    expect(hrefs).toContain(OVERVIEW_HREFS.royalties);
    expect(OVERVIEW_HREFS.enrollments).toBe("/account/enrollments");
    expect(OVERVIEW_HREFS.updates).toBe("/help/knowledge-base");
  });
});

describe("overview UI copy is Nexo-only and truthful", () => {
  it("does not include Symphonic branding or fake stream KPIs", () => {
    const files = [
      join(__dirname, "../../app/(portal)/dashboard/page.tsx"),
      join(__dirname, "../../components/portal/PortalOverview.tsx"),
      join(__dirname, "overview.ts"),
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const bad of FORBIDDEN_PORTAL_COPY) {
        expect(src).not.toContain(bad);
      }
      expect(src).not.toMatch(/fake (stream|kpi|revenue)/i);
    }
  });
});
