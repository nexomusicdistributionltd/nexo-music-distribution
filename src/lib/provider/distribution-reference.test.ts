import { beforeEach, describe, expect, it, vi } from "vitest";
import { distributionReference } from "./distribution-reference";
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("./oauth/store", () => ({ loadDistributionAccessToken: async () => "test", forceRefreshDistributionAccessToken: async () => null }));
vi.mock("./oauth/config", () => ({ readDistributionOAuthConfig: () => ({ apiBaseUrl: "https://api.toolost.test/v1" }) }));
const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
beforeEach(() => { fetcher.mockClear(); vi.stubGlobal("fetch", fetcher); });
function requestedUrl(): URL { return new URL(String((fetcher.mock.calls as unknown[][]).at(-1)?.[0])); }

describe("documented analytics request parameters", () => {
  it("supplies period to all period-required endpoints", async () => {
    for (const call of [() => distributionReference.analyticsOverview(), () => distributionReference.analyticsTrackCharts(), () => distributionReference.analyticsTrack("USABC2600001"), () => distributionReference.analytics()]) {
      await call(); expect(requestedUrl().searchParams.get("period")).toBe("lastThirtyDays");
    }
  });
  it("supplies required track pagination and preserves requested periods", async () => {
    await distributionReference.analyticsTracks();
    expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({ period: "lastThirtyDays", page: "1", perPage: "100" });
    await distributionReference.analyticsTracks({ period: "lastYear", page: 2, perPage: 250 });
    expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({ period: "lastYear", page: "2", perPage: "100" });
  });
  it("requires an explicit platform and supports an owned release filter", async () => {
    await distributionReference.analyticsPlatformData("spotify", "lastSevenDays", 42);
    expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({ period: "lastSevenDays", platform: "spotify", release: "42" });
    fetcher.mockClear();
    expect(() => distributionReference.analyticsPlatformData("")).toThrow("platform is required");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
