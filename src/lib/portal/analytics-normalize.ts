export type AnalyticsProviderRow = Record<string, unknown>;

const PLATFORM_KEYS = [
  "platform",
  "platform_name",
  "platformName",
  "channel",
  "channel_name",
  "channelName",
  "dsp",
  "dsp_name",
  "dspName",
  "store",
  "store_name",
  "storeName",
  "service",
  "service_name",
  "serviceName",
  "store_service",
  "storeService",
] as const;

const STREAM_KEYS = [
  "streams",
  "stream_count",
  "streamCount",
  "streams_count",
  "streamsCount",
  "plays",
  "play_count",
  "playCount",
  "units_streamed",
  "unitsStreamed",
  "streaming_units",
  "streamingUnits",
] as const;

const TREND_KEYS = [
  "trend_percent",
  "trendPercent",
  "change_percent",
  "changePercent",
  "percent_change",
  "percentChange",
  "growth_percent",
  "growthPercent",
] as const;

const DATE_KEYS = [
  "date",
  "day",
  "stream_date",
  "streamDate",
  "sale_date",
  "saleDate",
  "reporting_date",
  "reportingDate",
  "period",
  "period_start",
  "periodStart",
  "month",
] as const;

function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const object = value as AnalyticsProviderRow;
  for (const key of ["code", "slug", "name", "title", "label", "service", "platform"]) {
    const nested = object[key];
    if (typeof nested === "string" && nested.trim()) return nested.trim();
    if (typeof nested === "number" && Number.isFinite(nested)) return String(nested);
  }
  return null;
}

export function analyticsNumericValue(
  row: AnalyticsProviderRow,
  keys: readonly string[]
): number | null {
  for (const key of keys) {
    const raw = row[key];
    const value =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim()
          ? Number(raw.replace(/,/g, ""))
          : Number.NaN;
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function canonicalAnalyticsDsp(value: unknown): string {
  const raw = textValue(value)?.toLowerCase() ?? "";
  if (!raw) return "";

  if (raw.includes("audiomack")) return "audiomack";
  if (raw.includes("spotify")) return "spotify";
  if (raw.includes("apple") || raw.includes("itunes")) return "apple_music";
  if (raw.includes("youtube") || raw === "yt") return "youtube";
  if (raw.includes("amazon")) return "amazon";
  if (raw.includes("deezer")) return "deezer";
  if (raw.includes("tidal")) return "tidal";
  if (raw.includes("pandora")) return "pandora";
  if (raw.includes("soundcloud")) return "soundcloud";
  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("facebook") || raw.includes("instagram") || raw.includes("meta")) return "meta";

  return raw
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function analyticsPlatformCode(row: AnalyticsProviderRow): string {
  for (const key of PLATFORM_KEYS) {
    const code = canonicalAnalyticsDsp(row[key]);
    if (code) return code;
  }
  return "";
}

export function explicitStreamValue(row: AnalyticsProviderRow): number | null {
  const value = analyticsNumericValue(row, STREAM_KEYS);
  return value != null && value >= 0 ? value : null;
}

export function analyticsTrendValue(row: AnalyticsProviderRow): number | null {
  return analyticsNumericValue(row, TREND_KEYS);
}

function analyticsDateValue(row: AnalyticsProviderRow): string | null {
  for (const key of DATE_KEYS) {
    const value = textValue(row[key]);
    if (value) return value;
  }
  return null;
}

function dateRank(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function analyticsDspCodes(rows: AnalyticsProviderRow[]): string[] {
  return [...new Set(rows.map(analyticsPlatformCode).filter(Boolean))];
}

export function aggregateExplicitStreams(
  rows: AnalyticsProviderRow[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const dsp = analyticsPlatformCode(row);
    const streams = explicitStreamValue(row);
    if (!dsp || streams == null) continue;
    totals[dsp] = (totals[dsp] ?? 0) + streams;
  }
  return totals;
}

export function aggregateReportedTrends(
  rows: AnalyticsProviderRow[]
): Record<string, number> {
  const chosen = new Map<string, { value: number; rank: number }>();
  rows.forEach((row, index) => {
    const dsp = analyticsPlatformCode(row);
    const trend = analyticsTrendValue(row);
    if (!dsp || trend == null) return;
    const candidate = {
      value: trend,
      rank: dateRank(analyticsDateValue(row), index),
    };
    const current = chosen.get(dsp);
    if (!current || candidate.rank >= current.rank) chosen.set(dsp, candidate);
  });

  return Object.fromEntries(
    [...chosen.entries()].map(([dsp, value]) => [dsp, value.value])
  );
}

/**
 * Derives a change percentage only from two real, dated reporting periods.
 * This is used only when the provider did not return its own trend percentage.
 */
export function derivePreviousPeriodTrends(
  rows: AnalyticsProviderRow[]
): Record<string, number> {
  const byDsp = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const dsp = analyticsPlatformCode(row);
    const streams = explicitStreamValue(row);
    const period = analyticsDateValue(row);
    if (!dsp || streams == null || !period) continue;

    const periods = byDsp.get(dsp) ?? new Map<string, number>();
    periods.set(period, (periods.get(period) ?? 0) + streams);
    byDsp.set(dsp, periods);
  }

  const trends: Record<string, number> = {};
  for (const [dsp, periods] of byDsp) {
    if (periods.size < 2) continue;
    const ordered = [...periods.entries()].sort(([a], [b]) => {
      const aDate = Date.parse(a);
      const bDate = Date.parse(b);
      if (Number.isFinite(aDate) && Number.isFinite(bDate)) return bDate - aDate;
      return b.localeCompare(a);
    });
    const current = ordered[0]?.[1];
    const previous = ordered[1]?.[1];
    if (current == null || previous == null || previous <= 0) continue;
    trends[dsp] = ((current - previous) / previous) * 100;
  }

  return trends;
}

export function mergeMetricSources(
  ...sources: Array<Record<string, number>>
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (!(key in merged) && Number.isFinite(value)) merged[key] = value;
    }
  }
  return merged;
}
