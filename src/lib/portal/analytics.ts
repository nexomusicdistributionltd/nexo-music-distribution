import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ANALYTICS_DSP_MATCH, type AnalyticsKey } from "@/lib/portal/service-kinds";

export type AnalyticsSnapshot = {
  key: AnalyticsKey;
  connected: boolean;
  statusLabel: "LIVE" | "EMPTY" | "NOT CONNECTED";
  rowCount: number;
  amountMinor: number;
  currency: string | null;
  dspCodes: string[];
  note: string;
};

function matchesKey(dsp: string | null, key: AnalyticsKey): boolean {
  if (!dsp) return false;
  const needle = dsp.toLowerCase();
  return ANALYTICS_DSP_MATCH[key].some((code) => needle === code || needle.includes(code));
}

export async function loadAnalyticsSnapshot(
  ownerUserId: string,
  key: AnalyticsKey
): Promise<AnalyticsSnapshot> {
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
      statusLabel: "NOT CONNECTED",
      rowCount: 0,
      amountMinor: 0,
      currency: null,
      dspCodes: [],
      note: "Could not read ledger rows. Nothing is estimated.",
    };
  }

  const rows = (data ?? []).filter((r) => matchesKey(r.dsp_code as string | null, key));
  const codes = [...new Set(rows.map((r) => String(r.dsp_code)).filter(Boolean))];
  const amountMinor = rows.reduce((sum, r) => sum + Number(r.amount_minor || 0), 0);
  const currency = rows[0]?.currency ? String(rows[0].currency) : null;

  if (rows.length === 0) {
    return {
      key,
      connected: false,
      statusLabel: key === "spotify_discovery" || key === "streamsafe" ? "NOT CONNECTED" : "EMPTY",
      rowCount: 0,
      amountMinor: 0,
      currency: null,
      dspCodes: [],
      note:
        key === "spotify_discovery"
          ? "Spotify Discovery Mode is not enrolled on this account."
          : "No ingested statement rows for this source yet. Counts are not estimated.",
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
    note: "Figures come from posted ledger rows only.",
  };
}
