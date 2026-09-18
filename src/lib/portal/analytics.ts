import "server-only";

import { ANALYTICS_DSP_MATCH, type AnalyticsKey } from "@/lib/portal/service-kinds";
import { ownedAnalytics, ownedSales } from "@/lib/provider/owned-data";

type Row = Record<string, unknown>;

export type AnalyticsSnapshot = {
  key: AnalyticsKey;
  connected: boolean;
  statusLabel: "LIVE" | "CONNECTED" | "UNAVAILABLE";
  rowCount: number;
  amountMinor: number | null;
  currency: string | null;
  dspCodes: string[];
  streamCounts: Record<string, number>;
  trendPercentByDsp: Record<string, number>;
  metricTotals: Record<string, number>;
  updatedAt: string | null;
  note: string;
};

const METRICS = {
  streams: ["streams", "stream_count", "streamCount", "total_streams", "totalStreams", "plays", "play_count", "playCount"],
  downloads: ["downloads", "download_count", "downloadCount", "units", "quantity"],
  video_creations: ["video_creations", "videoCreations", "total_video_creations", "totalVideoCreations", "creations", "creates", "uses"],
  views: ["views", "view_count", "viewCount", "total_views", "totalViews"],
  likes: ["likes", "like_count", "likeCount", "total_likes", "totalLikes"],
  comments: ["comments", "comment_count", "commentCount", "total_comments", "totalComments"],
  shares: ["shares", "share_count", "shareCount", "total_shares", "totalShares"],
  listeners: ["listeners", "listener_count", "listenerCount", "unique_listeners", "uniqueListeners"],
  saves: ["saves", "save_count", "saveCount", "total_saves", "totalSaves"],
  skips: ["skips", "skip_count", "skipCount", "total_skips", "totalSkips"],
  playlist_adds: ["playlist_adds", "playlistAdds", "playlist_additions", "playlistAdditions"],
  first_time_listeners: ["first_time_listeners", "firstTimeListeners", "new_listeners", "newListeners"],
  discovery_mode_streams: ["discovery_mode_streams", "discoveryModeStreams", "discovery_streams", "discoveryStreams"],
  completion_rate: ["completion_rate", "completionRate"],
  shuffle_rate: ["shuffle_rate", "shuffleRate"],
  weekly_engagement: ["weekly_engagement", "weeklyEngagement"],
  hourly_engagement: ["hourly_engagement", "hourlyEngagement"],
  suspicious_streams: ["suspicious_streams", "suspiciousStreams", "flagged_streams", "flaggedStreams"],
  artificial_streams: ["artificial_streams", "artificialStreams", "fraudulent_streams", "fraudulentStreams", "invalid_streams", "invalidStreams"],
  suspicious_rate: ["suspicious_rate", "suspiciousRate", "fraud_rate", "fraudRate", "artificial_rate", "artificialRate"],
} as const;

type MetricName = keyof typeof METRICS;

const STREAM_PLATFORMS = [
  "spotify",
  "apple",
  "apple_music",
  "audiomack",
  "amazon",
  "amazon_music",
  "deezer",
  "tidal",
  "pandora",
  "youtube",
  "soundcloud",
];

function numericValue(row: Row, keys: readonly string[]): number | null {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      const normalized = raw.trim().replace(/,/g, "").replace(/%$/, "");
      const value = Number(normalized);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function stringValue(row: Row, keys: string[]): string | null {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return null;
}

function platformCode(row: Row): string {
  return String(
    row.platform ??
      row.channel ??
      row.dsp ??
      row.store ??
      row.service ??
      row.store_service ??
      row.storeService ??
      ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function rowText(row: Row): string {
  const selectedValues = [
    row.platform,
    row.channel,
    row.dsp,
    row.store,
    row.service,
    row.metric,
    row.category,
    row.type,
    row.analytics_section,
    row._analytics_source,
  ]
    .filter((value) => typeof value === "string")
    .join(" ");
  return `${Object.keys(row).join(" ")} ${selectedValues}`.toLowerCase().replace(/[\s-]+/g, "_");
}

function hasMetric(row: Row, metric: MetricName): boolean {
  return numericValue(row, METRICS[metric]) != null;
}

function matchesDsp(dsp: string, key: AnalyticsKey): boolean {
  if (!dsp) return false;
  return ANALYTICS_DSP_MATCH[key].some((code) => dsp === code || dsp.includes(code));
}

function matchesAnalyticsKey(row: Row, key: AnalyticsKey): boolean {
  const dsp = platformCode(row);
  const text = rowText(row);

  if (key === "streams") {
    return hasMetric(row, "streams") && (!dsp || STREAM_PLATFORMS.some((code) => dsp.includes(code)));
  }
  if (key === "meta") {
    return matchesDsp(dsp, key) || /(^|_)(meta|facebook|instagram)(_|$)/.test(text);
  }
  if (key === "youtube_ugc") {
    return (
      matchesDsp(dsp, key) ||
      (text.includes("youtube") &&
        (text.includes("ugc") || text.includes("content_id") || text.includes("contentid") || hasMetric(row, "video_creations")))
    );
  }
  if (key === "tiktok") {
    return matchesDsp(dsp, key) || text.includes("tiktok");
  }
  if (key === "streamsafe") {
    return (
      matchesDsp(dsp, key) ||
      text.includes("streamsafe") ||
      text.includes("artificial") ||
      text.includes("fraud") ||
      text.includes("suspicious") ||
      text.includes("invalid_stream")
    );
  }
  if (key === "spotify_discovery") {
    return (
      hasMetric(row, "discovery_mode_streams") ||
      (text.includes("discovery") && hasMetric(row, "streams")) ||
      (text.includes("spotify") && text.includes("discovery"))
    );
  }
  if (key === "spotify_engagement") {
    const spotify = dsp.includes("spotify") || text.includes("spotify");
    return (
      spotify &&
      (hasMetric(row, "listeners") ||
        hasMetric(row, "saves") ||
        hasMetric(row, "skips") ||
        hasMetric(row, "playlist_adds") ||
        hasMetric(row, "first_time_listeners") ||
        hasMetric(row, "completion_rate") ||
        hasMetric(row, "shuffle_rate") ||
        hasMetric(row, "weekly_engagement") ||
        hasMetric(row, "hourly_engagement"))
    );
  }
  if (key === "downloads") {
    return (
      hasMetric(row, "downloads") ||
      text.includes("download") ||
      dsp.includes("itunes") ||
      dsp.includes("amazon_download")
    );
  }
  return false;
}

function sourceRank(row: Row): number {
  switch (String(row._analytics_source ?? "")) {
    case "track_detail":
      return 0;
    case "tracks":
      return 1;
    case "track_charts":
      return 2;
    case "platform_data":
      return 3;
    case "overview":
      return 4;
    case "sales":
      return 5;
    default:
      return 6;
  }
}

function rowIdentity(row: Row, index: number): string {
  return (
    stringValue(row, ["isrc", "ISRC", "track_isrc", "release_id", "releaseId", "provider_release_id", "providerReleaseId", "id"]) ??
    `row-${index}`
  );
}

function rowDate(row: Row): string | null {
  return stringValue(row, [
    "date",
    "day",
    "week",
    "month",
    "period",
    "period_start",
    "periodStart",
    "timestamp",
    "updated_at",
    "updatedAt",
    "last_updated",
    "lastUpdated",
  ]);
}

function aggregateMetric(
  rows: Row[],
  aliases: readonly string[],
  mode: "sum" | "latest" = "sum"
): number | null {
  const groups = new Map<string, Array<{ row: Row; value: number; date: string | null }>>();

  rows.forEach((row, index) => {
    const value = numericValue(row, aliases);
    if (value == null) return;
    const key = `${rowIdentity(row, index)}|${platformCode(row) || "all"}|${String(row.analytics_section ?? "")}`;
    const list = groups.get(key) ?? [];
    list.push({ row, value, date: rowDate(row) });
    groups.set(key, list);
  });

  if (groups.size === 0) return null;

  let total = 0;
  const latestValues: number[] = [];
  for (const entries of groups.values()) {
    const bestRank = Math.min(...entries.map((entry) => sourceRank(entry.row)));
    const preferred = entries.filter((entry) => sourceRank(entry.row) === bestRank);

    if (mode === "latest") {
      const withDate = preferred
        .filter((entry) => entry.date)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      latestValues.push((withDate[0] ?? preferred[preferred.length - 1]).value);
      continue;
    }

    const summary = preferred.filter((entry) => !entry.date);
    if (summary.length > 0) {
      total += Math.max(...summary.map((entry) => entry.value));
      continue;
    }

    const byDate = new Map<string, number>();
    for (const entry of preferred) {
      const date = entry.date ?? "undated";
      byDate.set(date, Math.max(byDate.get(date) ?? Number.NEGATIVE_INFINITY, entry.value));
    }
    total += [...byDate.values()].reduce((sum, value) => sum + value, 0);
  }

  if (mode === "latest") {
    return latestValues.length > 0
      ? latestValues.reduce((sum, value) => sum + value, 0) / latestValues.length
      : null;
  }
  return total;
}

function streamCountsByPlatform(rows: Row[]): Record<string, number> {
  const platforms = [...new Set(rows.map(platformCode).filter(Boolean))];
  const result: Record<string, number> = {};
  for (const platform of platforms) {
    const value = aggregateMetric(
      rows.filter((row) => platformCode(row) === platform),
      METRICS.streams,
      "sum"
    );
    if (value != null) result[platform] = value;
  }
  return result;
}

function trendPercentByPlatform(rows: Row[]): Record<string, number> {
  const aliases = [
    "trend_percent",
    "trendPercent",
    "change_percent",
    "changePercent",
    "percent_change",
    "percentChange",
  ];
  const result: Record<string, number> = {};
  for (const platform of [...new Set(rows.map(platformCode).filter(Boolean))]) {
    const values = rows
      .filter((row) => platformCode(row) === platform)
      .map((row) => numericValue(row, aliases))
      .filter((value): value is number => value != null);
    if (values.length > 0) result[platform] = values[values.length - 1];
  }
  return result;
}

function metricNamesForKey(key: AnalyticsKey): MetricName[] {
  switch (key) {
    case "streams":
      return ["streams", "listeners"];
    case "meta":
    case "youtube_ugc":
    case "tiktok":
      return ["video_creations", "views", "likes", "comments", "shares"];
    case "streamsafe":
      return ["suspicious_streams", "artificial_streams", "suspicious_rate"];
    case "spotify_discovery":
      return ["discovery_mode_streams", "saves", "playlist_adds", "first_time_listeners"];
    case "spotify_engagement":
      return [
        "streams",
        "listeners",
        "saves",
        "skips",
        "playlist_adds",
        "first_time_listeners",
        "completion_rate",
        "shuffle_rate",
        "weekly_engagement",
        "hourly_engagement",
      ];
    case "downloads":
      return ["downloads"];
  }
}

function buildMetricTotals(rows: Row[], key: AnalyticsKey): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const metric of metricNamesForKey(key)) {
    const isRate = metric.endsWith("_rate");
    const aliases =
      key === "spotify_discovery" && metric === "discovery_mode_streams"
        ? [...METRICS.discovery_mode_streams, ...METRICS.streams]
        : METRICS[metric];
    const value = aggregateMetric(rows, aliases, isRate ? "latest" : "sum");
    if (value != null) totals[metric] = value;
  }
  return totals;
}

function latestUpdatedAt(rows: Row[]): string | null {
  const dates = rows.map(rowDate).filter((value): value is string => Boolean(value));
  return dates.sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function salesSupplementNeeded(rows: Row[], key: AnalyticsKey): boolean {
  if (key === "streams") return !rows.some((row) => hasMetric(row, "streams"));
  if (key === "downloads") return !rows.some((row) => hasMetric(row, "downloads"));
  return false;
}

export async function loadAnalyticsSnapshot(
  ownerUserId: string,
  key: AnalyticsKey
): Promise<AnalyticsSnapshot> {
  try {
    const provider = await ownedAnalytics(ownerUserId);
    let rows = provider.rows.filter((row) => matchesAnalyticsKey(row, key));
    let connected = provider.connected;

    if (salesSupplementNeeded(rows, key)) {
      try {
        const salesKind = key === "downloads" ? "tracks" : "channels";
        const salesRows = await ownedSales(ownerUserId, salesKind);
        const supplement = salesRows
          .map((row) => ({ ...row, _analytics_source: "sales" }))
          .filter((row) => matchesAnalyticsKey(row, key));
        rows = [...rows, ...supplement];
        connected = true;
      } catch {
        // Analytics stays usable even when the sales supplement is unavailable.
      }
    }

    const dspCodes = [...new Set(rows.map(platformCode).filter(Boolean))];
    const streamCounts = streamCountsByPlatform(rows);
    const metricTotals = buildMetricTotals(rows, key);
    const hasLiveValues =
      rows.length > 0 &&
      (Object.keys(metricTotals).length > 0 || Object.keys(streamCounts).length > 0);

    const statusLabel: AnalyticsSnapshot["statusLabel"] = hasLiveValues
      ? "LIVE"
      : connected
        ? "CONNECTED"
        : "UNAVAILABLE";

    const note =
      statusLabel === "LIVE"
        ? "Live distribution analytics are being read from the connected provider for catalog owned by this Nexo account. Values are never estimated or generated by Nexo."
        : statusLabel === "CONNECTED"
          ? provider.hasCatalogScope
            ? "The live analytics connection is active. The provider has not returned reportable rows for this analytics source on this account yet."
            : "The live analytics connection is active, but this account does not yet have linked distributed catalog identifiers to query."
          : "Live distribution analytics are temporarily unavailable. Nexo is not substituting statement rows or invented counts.";

    return {
      key,
      connected,
      statusLabel,
      rowCount: rows.length,
      amountMinor: null,
      currency: null,
      dspCodes,
      streamCounts,
      trendPercentByDsp: trendPercentByPlatform(rows),
      metricTotals,
      updatedAt: latestUpdatedAt(rows),
      note,
    };
  } catch {
    return {
      key,
      connected: false,
      statusLabel: "UNAVAILABLE",
      rowCount: 0,
      amountMinor: null,
      currency: null,
      dspCodes: [],
      streamCounts: {},
      trendPercentByDsp: {},
      metricTotals: {},
      updatedAt: null,
      note: "Live distribution analytics are temporarily unavailable. Nexo is not substituting statement rows or invented counts.",
    };
  }
}
