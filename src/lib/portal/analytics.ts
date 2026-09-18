import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ANALYTICS_DSP_MATCH, type AnalyticsKey } from "@/lib/portal/service-kinds";
import { ownedAnalytics, ownedSales } from "@/lib/provider/owned-data";

export type AnalyticsTrendPoint = { date: string; streams: number };

export type AnalyticsSnapshot = {
  key: AnalyticsKey;
  connected: boolean;
  statusLabel: "LIVE" | "EMPTY" | "AVAILABLE";
  rowCount: number;
  amountMinor: number | null;
  currency: string | null;
  dspCodes: string[];
  dspStreams: Record<string, number>;
  trend: AnalyticsTrendPoint[];
  note: string;
};

function matchesKey(dsp: string | null, key: AnalyticsKey): boolean {
  if (!dsp) return false;
  const needle = dsp.toLowerCase();
  return ANALYTICS_DSP_MATCH[key].some((code) => needle === code || needle.includes(code));
}

function stringField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function numberField(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function normalizeProviderAnalytics(rows: Record<string, unknown>[]) {
  const dspStreams: Record<string, number> = {};
  const trendMap = new Map<string, number>();
  const dspCodes: string[] = [];

  for (const row of rows) {
    const dsp = stringField(row, [
      "platform",
      "platform_name",
      "channel",
      "dsp",
      "dsp_code",
      "store",
      "service",
    ]);
    if (dsp) dspCodes.push(dsp);

    const streams = numberField(row, [
      "streams",
      "stream_count",
      "streamCount",
      "plays",
      "play_count",
      "playCount",
      "quantity",
      "count",
    ]);
    if (dsp && streams != null) {
      const key = dsp.toLowerCase();
      dspStreams[key] = (dspStreams[key] ?? 0) + streams;
    }

    const date = stringField(row, [
      "date",
      "day",
      "report_date",
      "reportDate",
      "period_start",
      "periodStart",
    ]);
    if (date && streams != null) {
      const normalizedDate = /^\d{4}-\d{2}-\d{2}/.exec(date)?.[0] ?? date;
      trendMap.set(normalizedDate, (trendMap.get(normalizedDate) ?? 0) + streams);
    }
  }

  const trend = [...trendMap.entries()]
    .map(([date, streams]) => ({ date, streams }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  return {
    dspCodes: [...new Set(dspCodes)],
    dspStreams,
    trend,
  };
}

export async function loadAnalyticsSnapshot(
  ownerUserId: string,
  key: AnalyticsKey
): Promise<AnalyticsSnapshot> {
  try {
    const providerRows = key === "streams"
      ? await ownedAnalytics(ownerUserId)
      : await ownedSales(ownerUserId, "overview");
    if (providerRows.length > 0) {
      const normalized = normalizeProviderAnalytics(providerRows);
      return {
        key,
        connected: true,
        statusLabel: "LIVE",
        rowCount: providerRows.length,
        amountMinor: null,
        currency: null,
        dspCodes: normalized.dspCodes,
        dspStreams: normalized.dspStreams,
        trend: normalized.trend,
        note:
          normalized.trend.length > 0
            ? "Live Distribution Engine analytics for releases owned by this account."
            : "Live Distribution Engine rows are available. Stream totals are shown only when the upstream row supplies a verified play/stream count.",
      };
    }
  } catch {
    // The portal remains usable; posted Nexo ledger rows are the authoritative fallback.
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
      dspStreams: {},
      trend: [],
      note: "No verified analytics rows can be displayed for this source right now.",
    };
  }

  const rows = (data ?? []).filter((r) => matchesKey(r.dsp_code as string | null, key));
  const codes = [...new Set(rows.map((r) => String(r.dsp_code)).filter(Boolean))];
  const amountMinor = rows.reduce((sum, r) => sum + Number(r.amount_minor || 0), 0);
  const currency = rows[0]?.currency ? String(rows[0].currency) : null;

  if (rows.length === 0) {
    return {
      key,
      connected: true,
      statusLabel: "EMPTY",
      rowCount: 0,
      amountMinor: 0,
      currency: null,
      dspCodes: [],
      dspStreams: {},
      trend: [],
      note:
        key === "spotify_discovery"
          ? "No verified Spotify Discovery Mode enrollment or activity rows are available for this account yet."
          : key === "streamsafe"
            ? "No verified suspicious-stream flags are available for this account."
            : "No verified analytics rows are available for this source yet.",
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
    dspStreams: {},
    trend: [],
    note: "Posted royalty ledger rows are available. Stream counts are not inferred from money values.",
  };
}
