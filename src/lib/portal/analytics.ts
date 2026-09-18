import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ANALYTICS_DSP_MATCH, type AnalyticsKey } from "@/lib/portal/service-kinds";
import { ownedAnalytics, ownedSales } from "@/lib/provider/owned-data";

export type AnalyticsTrendPoint = {
  date: string;
  streams: number;
};

export type DspAnalyticsRow = {
  code: string;
  streams: number;
};

export type AnalyticsSnapshot = {
  key: AnalyticsKey;
  connected: boolean;
  statusLabel: "LIVE" | "EMPTY" | "AVAILABLE";
  rowCount: number;
  amountMinor: number | null;
  currency: string | null;
  dspCodes: string[];
  dspStreams: DspAnalyticsRow[];
  totalStreams: number;
  trend: AnalyticsTrendPoint[];
  note: string;
};

function matchesKey(dsp: string | null, key: AnalyticsKey): boolean {
  if (!dsp) return false;
  const needle = dsp.toLowerCase();
  return ANALYTICS_DSP_MATCH[key].some((code) => needle === code || needle.includes(code));
}

function firstString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function normalizeDsp(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function aggregateProviderAnalytics(rows: Record<string, unknown>[]) {
  const byDsp = new Map<string, number>();
  const byDate = new Map<string, number>();
  let totalStreams = 0;

  for (const row of rows) {
    const dsp = firstString(row, [
      "platform",
      "channel",
      "dsp",
      "service",
      "store",
      "platform_name",
      "channel_name",
    ]);
    const streams = Math.max(
      0,
      firstNumber(row, [
        "streams",
        "stream_count",
        "total_streams",
        "plays",
        "play_count",
        "units",
        "count",
      ])
    );
    if (dsp) {
      const code = normalizeDsp(dsp);
      byDsp.set(code, (byDsp.get(code) ?? 0) + streams);
    }
    totalStreams += streams;

    const rawDate = firstString(row, [
      "date",
      "day",
      "sale_date",
      "reporting_date",
      "accounting_date",
      "period",
    ]);
    if (rawDate && streams > 0) {
      const date = rawDate.slice(0, 10);
      byDate.set(date, (byDate.get(date) ?? 0) + streams);
    }
  }

  return {
    dspStreams: [...byDsp.entries()]
      .map(([code, streams]) => ({ code, streams }))
      .sort((a, b) => b.streams - a.streams),
    totalStreams,
    trend: [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, streams]) => ({ date, streams })),
  };
}

export async function loadAnalyticsSnapshot(
  ownerUserId: string,
  key: AnalyticsKey
): Promise<AnalyticsSnapshot> {
  // Prefer live Distribution Engine data scoped to releases owned by this account.
  // Never fill gaps with generated numbers.
  try {
    const providerRows =
      key === "streams"
        ? await ownedAnalytics(ownerUserId)
        : await ownedSales(ownerUserId, "overview");
    if (providerRows.length > 0) {
      const aggregate = aggregateProviderAnalytics(providerRows);
      const codes = aggregate.dspStreams.map((row) => row.code);
      return {
        key,
        connected: true,
        statusLabel: "LIVE",
        rowCount: providerRows.length,
        amountMinor: null,
        currency: null,
        dspCodes: codes,
        dspStreams: aggregate.dspStreams,
        totalStreams: aggregate.totalStreams,
        trend: aggregate.trend,
        note:
          aggregate.totalStreams > 0
            ? "Live Distribution Engine analytics for releases owned by this account."
            : "Live Distribution Engine analytics are connected; the upstream returned rows without a positive stream count.",
      };
    }
  } catch {
    // Continue to the authoritative Nexo ledger fallback.
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id, amount_minor, currency, dsp_code, kind, occurred_at, created_at")
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
      dspStreams: [],
      totalStreams: 0,
      trend: [],
      note:
        "Analytics are available through Nexo. No verified rows can be displayed for this source right now.",
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
      dspStreams: [],
      totalStreams: 0,
      trend: [],
      note:
        key === "spotify_discovery"
          ? "Spotify Discovery Mode is available through Nexo. No verified enrollment or activity rows are available for this account yet."
          : key === "streamsafe"
            ? "StreamSafe is available through Nexo. No verified suspicious-stream flags are available for this account."
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
    dspStreams: [],
    totalStreams: 0,
    trend: [],
    note: "Figures come from posted Nexo ledger rows only.",
  };
}
