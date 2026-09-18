import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ANALYTICS_DSP_MATCH, type AnalyticsKey } from "@/lib/portal/service-kinds";
import { ownedAnalytics, ownedSales } from "@/lib/provider/owned-data";

export type AnalyticsSnapshot = {
  key: AnalyticsKey;
  connected: boolean;
  statusLabel: "LIVE" | "EMPTY" | "AVAILABLE";
  rowCount: number;
  amountMinor: number | null;
  currency: string | null;
  dspCodes: string[];
  streamCounts: Record<string, number>;
  note: string;
};

function numericValue(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = row[key];
    const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function platformCode(row: Record<string, unknown>): string {
  return String(row.platform ?? row.channel ?? row.dsp ?? row.store ?? "").trim().toLowerCase();
}

function realStreamCounts(rows: Record<string, unknown>[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const platform = platformCode(row);
    const count = numericValue(row, ["streams", "stream_count", "streamCount", "plays", "play_count", "count"]);
    if (!platform || count == null || count < 0) continue;
    totals[platform] = (totals[platform] ?? 0) + count;
  }
  return totals;
}

function matchesKey(dsp: string | null, key: AnalyticsKey): boolean {
  if (!dsp) return false;
  const needle = dsp.toLowerCase();
  return ANALYTICS_DSP_MATCH[key].some((code) => needle === code || needle.includes(code));
}

export async function loadAnalyticsSnapshot(
  ownerUserId: string,
  key: AnalyticsKey
): Promise<AnalyticsSnapshot> {
  // Prefer live Distribution Engine analytics for releases owned by this account.
  // Fall back to Nexo ledger rows when the upstream has no rows yet.
  try {
    const providerRows = key === "streams"
      ? await ownedAnalytics(ownerUserId)
      : await ownedSales(ownerUserId, "overview");
    if (providerRows.length > 0) {
      const typedRows = providerRows as Record<string, unknown>[];
      const codes = [...new Set(typedRows.map(platformCode).filter(Boolean))];
      const streamCounts = key === "streams" ? realStreamCounts(typedRows) : {};
      return {
        key,
        connected: true,
        statusLabel: "LIVE",
        rowCount: providerRows.length,
        amountMinor: null,
        currency: null,
        dspCodes: codes,
        streamCounts,
        note: "Live Distribution Engine analytics are connected for releases owned by this account. Stream totals are shown only when the provider returns numeric stream data.",
      };
    }
  } catch {
    // Continue to the authoritative Nexo ledger fallback below.
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
      note: "Analytics are available through Nexo. No verified rows can be displayed for this source right now.",
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
    streamCounts: {},
    note: "Figures come from posted ledger rows only. Ledger money rows are never converted into invented stream counts.",
  };
}
