import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ANALYTICS_DSP_MATCH, type AnalyticsKey } from "@/lib/portal/service-kinds";
import { ownedAnalytics, ownedSales } from "@/lib/provider/owned-data";
import {
  aggregateExplicitStreams,
  aggregateReportedTrends,
  analyticsDspCodes,
  analyticsPlatformCode,
  derivePreviousPeriodTrends,
  mergeMetricSources,
} from "@/lib/portal/analytics-normalize";

export type AnalyticsSnapshot = {
  key: AnalyticsKey;
  connected: boolean;
  statusLabel: "LIVE" | "CONNECTED" | "AVAILABLE";
  rowCount: number;
  amountMinor: number | null;
  currency: string | null;
  dspCodes: string[];
  streamCounts: Record<string, number>;
  trendPercentByDsp: Record<string, number>;
  note: string;
};

function matchesKey(dsp: string | null, key: AnalyticsKey): boolean {
  if (!dsp) return false;
  const needle = dsp.toLowerCase();
  return ANALYTICS_DSP_MATCH[key].some((code) => needle === code || needle.includes(code));
}

function uniqueRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function liveStreamSnapshot(ownerUserId: string): Promise<AnalyticsSnapshot | null> {
  const [analyticsResult, channelResult, overviewResult] = await Promise.allSettled([
    ownedAnalytics(ownerUserId),
    ownedSales(ownerUserId, "channels"),
    ownedSales(ownerUserId, "overview"),
  ]);

  const analyticsRows =
    analyticsResult.status === "fulfilled"
      ? (analyticsResult.value as Record<string, unknown>[])
      : [];
  const channelRows =
    channelResult.status === "fulfilled"
      ? (channelResult.value as Record<string, unknown>[])
      : [];
  const overviewRows =
    overviewResult.status === "fulfilled"
      ? (overviewResult.value as Record<string, unknown>[])
      : [];

  const providerSucceeded =
    analyticsResult.status === "fulfilled" ||
    channelRows.length > 0 ||
    overviewRows.length > 0;

  const rows = uniqueRows([...analyticsRows, ...channelRows, ...overviewRows]);

  if (rows.length === 0) {
    if (!providerSucceeded) return null;
    return {
      key: "streams",
      connected: true,
      statusLabel: "CONNECTED",
      rowCount: 0,
      amountMinor: null,
      currency: null,
      dspCodes: [],
      streamCounts: {},
      trendPercentByDsp: {},
      note:
        "Distribution analytics are connected. DSP stream reports will appear here as soon as the provider returns reporting rows for this catalog.",
    };
  }

  // TooLost analytics resources can overlap. Pick one source per DSP in a
  // deterministic priority order instead of summing the same activity twice.
  const analyticsBySource = (source: string) =>
    analyticsRows.filter((row) => String(row.analytics_source ?? "") === source);
  const trackDetailRows = analyticsBySource("analytics_track_detail");
  const platformDataRows = analyticsBySource("analytics_platform_data");
  const trackRows = analyticsBySource("analytics_tracks");
  const analyticsOverviewRows = analyticsBySource("analytics_overview");

  const metricSources = [
    platformDataRows,
    trackRows,
    analyticsOverviewRows,
    trackDetailRows,
    channelRows,
    overviewRows,
  ];

  const streamCounts = mergeMetricSources(
    ...metricSources.map((sourceRows) => aggregateExplicitStreams(sourceRows))
  );

  const trendPercentByDsp = mergeMetricSources(
    ...metricSources.map((sourceRows) => aggregateReportedTrends(sourceRows)),
    ...metricSources.map((sourceRows) => derivePreviousPeriodTrends(sourceRows))
  );

  const dspCodes = [
    ...new Set([
      ...analyticsDspCodes(analyticsRows),
      ...analyticsDspCodes(channelRows),
      ...analyticsDspCodes(overviewRows),
    ]),
  ];

  return {
    key: "streams",
    connected: true,
    statusLabel: "LIVE",
    rowCount: rows.length,
    amountMinor: null,
    currency: null,
    dspCodes,
    streamCounts,
    trendPercentByDsp,
    note:
      "Live distribution reporting is scoped to this account's releases and tracks. Stream totals are shown only for explicit stream/play metrics; trends are provider-reported or derived from consecutive dated stream reports.",
  };
}

export async function loadAnalyticsSnapshot(
  ownerUserId: string,
  key: AnalyticsKey
): Promise<AnalyticsSnapshot> {
  if (key === "streams") {
    const live = await liveStreamSnapshot(ownerUserId);
    if (live) return live;
  } else {
    try {
      const allProviderRows = await ownedAnalytics(ownerUserId);
      const typedRows = (allProviderRows as Record<string, unknown>[]).filter((row) =>
        matchesKey(analyticsPlatformCode(row), key)
      );

      if (typedRows.length > 0) {
        const codes = analyticsDspCodes(typedRows);
        const streamCounts = aggregateExplicitStreams(typedRows);
        const trendPercentByDsp = mergeMetricSources(
          aggregateReportedTrends(typedRows),
          derivePreviousPeriodTrends(typedRows)
        );

        return {
          key,
          connected: true,
          statusLabel: "LIVE",
          rowCount: typedRows.length,
          amountMinor: null,
          currency: null,
          dspCodes: codes,
          streamCounts,
          trendPercentByDsp,
          note:
            "Live distribution analytics are connected for releases and tracks owned by this account. No values are estimated.",
        };
      }
    } catch {
      // Continue to the authoritative Nexo ledger fallback below.
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id, amount_minor, currency, dsp_code, kind")
    .eq("owner_user_id", ownerUserId)
    .limit(2000);

  if (error) {
    return {
      key,
      connected: false,
      statusLabel: "AVAILABLE",
      rowCount: 0,
      amountMinor: null,
      currency: null,
      dspCodes: [],
      streamCounts: {},
      trendPercentByDsp: {},
      note: "Analytics are temporarily unavailable. No unverified values are shown.",
    };
  }

  const rows = (data ?? []).filter((row) =>
    matchesKey(String(row.dsp_code ?? "").toLowerCase(), key)
  );
  const codes = [
    ...new Set(
      rows
        .map((row) => analyticsPlatformCode({ platform: row.dsp_code }))
        .filter(Boolean)
    ),
  ];
  const amountMinor = rows.reduce((sum, row) => sum + Number(row.amount_minor || 0), 0);
  const currency = rows[0]?.currency ? String(rows[0].currency) : null;

  if (rows.length === 0) {
    return {
      key,
      connected: true,
      statusLabel: "CONNECTED",
      rowCount: 0,
      amountMinor: 0,
      currency: null,
      dspCodes: [],
      streamCounts: {},
      trendPercentByDsp: {},
      note:
        key === "spotify_discovery"
          ? "Spotify Discovery Mode reporting is available. No verified enrollment or activity rows are available for this account yet."
          : key === "streamsafe"
            ? "StreamSafe reporting is available. No verified suspicious-stream flags are available for this account."
            : "Reporting is connected, but no verified analytics rows are available for this account yet.",
    };
  }

  return {
    key,
    connected: true,
    statusLabel: "LIVE",
    rowCount: rows.length,
    amountMinor,
    currency,
    dspCodes: codes,
    streamCounts: {},
    trendPercentByDsp: {},
    note:
      "Figures come from posted ledger rows only. Financial rows are never converted into invented stream counts.",
  };
}
