import { describe, expect, it } from "vitest";
import {
  aggregateExplicitStreams,
  aggregateReportedTrends,
  analyticsDspCodes,
  analyticsPlatformCode,
  derivePreviousPeriodTrends,
  mergeMetricSources,
} from "@/lib/portal/analytics-normalize";

describe("analytics provider normalization", () => {
  it("normalizes real DSP names and nested provider platform objects", () => {
    expect(analyticsPlatformCode({ platform: "Apple Music" })).toBe("apple_music");
    expect(analyticsPlatformCode({ store_name: "Amazon Music" })).toBe("amazon");
    expect(analyticsPlatformCode({ service: { code: "PANDORA", name: "Pandora" } })).toBe("pandora");
    expect(analyticsDspCodes([
      { channel: "Spotify" },
      { platformName: "Audiomack" },
      { store: "TIDAL" },
    ])).toEqual(["spotify", "audiomack", "tidal"]);
  });

  it("aggregates only explicit stream/play metrics and never money or generic units", () => {
    const totals = aggregateExplicitStreams([
      { platform: "Spotify", streams: 1200 },
      { platform: "Spotify", plays: "300" },
      { platform: "Apple Music", revenue: 99.25, units: 800 },
      { platform: "Pandora", stream_count: "1,500" },
    ]);

    expect(totals.spotify).toBe(1500);
    expect(totals.pandora).toBe(1500);
    expect(totals.apple_music).toBeUndefined();
  });

  it("prefers provider-reported trends and can derive a previous-period trend from real rows", () => {
    const rows = [
      { platform: "Spotify", date: "2026-09-17", streams: 120, trend_percent: 8.5 },
      { platform: "Spotify", date: "2026-09-18", streams: 150, trend_percent: 10 },
      { platform: "Pandora", date: "2026-09-17", streams: 100 },
      { platform: "Pandora", date: "2026-09-18", streams: 125 },
    ];

    expect(aggregateReportedTrends(rows).spotify).toBe(10);
    expect(derivePreviousPeriodTrends(rows).pandora).toBe(25);

    expect(
      mergeMetricSources(
        aggregateReportedTrends(rows),
        derivePreviousPeriodTrends(rows)
      )
    ).toMatchObject({ spotify: 10, pandora: 25 });
  });

  it("does not invent an infinite trend when the previous reported period is zero", () => {
    const trends = derivePreviousPeriodTrends([
      { platform: "Deezer", date: "2026-09-17", streams: 0 },
      { platform: "Deezer", date: "2026-09-18", streams: 20 },
    ]);
    expect(trends.deezer).toBeUndefined();
  });
});
