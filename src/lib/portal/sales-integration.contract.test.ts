import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("TooLost sales portal contract", () => {
  it("uses no-store realtime reads for sales and analytics resources", () => {
    const source = read("src/lib/provider/distribution-reference.ts");
    expect(source).toContain('cache: "no-store"');
    expect(source).toContain('realtimeApi(withQuery("/sales/overview"');
    expect(source).toContain('realtimeApi(withQuery("/sales/stream-rates"');
    expect(source).toContain('analyticsOverview: () => realtimeApi("/analytics/overview")');
    expect(source).toContain('analyticsPlatformData: () => realtimeApi("/analytics/platforms/data")');
  });

  it("scopes release, track and artist sales with direct owned-catalog lookups", () => {
    const source = read("src/lib/provider/owned-data.ts");
    expect(source).toContain("distributionReference.salesReleaseOverview");
    expect(source).toContain("distributionReference.salesTrackOverview");
    expect(source).toContain("distributionReference.salesArtistOverview");
    expect(source).toContain("distributionReference.salesReleaseChannels");
    expect(source).toContain("distributionReference.salesReleaseTerritories");
    expect(source).toContain('"dividends"');
    expect(source).not.toContain('if (!scope.providerIds.size && kind !== "streamRates") return [];');
  });

  it("does not expose provider-connection diagnostics to artist or label users", () => {
    const sales = read("src/lib/portal/sales.ts");
    const dashboard = read("src/components/portal/SalesDashboard.tsx");

    expect(sales).not.toContain("The provider connection is available");
    expect(sales).not.toContain("Live provider sales data");
    expect(dashboard).not.toContain('title={snapshot.connected ? "LIVE"');
    expect(dashboard).toContain("Reporting temporarily unavailable");
    expect(dashboard).toContain("No reported activity yet");
  });

  it("maps TooLost dividends and stream-rate values into portal rows", () => {
    const source = read("src/lib/portal/sales.ts");
    expect(source).toContain('"dividends"');
    expect(source).toContain('"stream_rate"');
    expect(source).toContain('"streamRate"');
    expect(source).toContain('status: "ready" | "empty" | "unavailable"');
  });
});
