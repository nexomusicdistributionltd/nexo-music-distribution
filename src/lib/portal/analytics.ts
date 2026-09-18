import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ANALYTICS_DSP_MATCH, type AnalyticsKey } from "@/lib/portal/service-kinds";
import { ownedAnalytics, ownedSales } from "@/lib/provider/owned-data";

type ProviderRow = Record<string, unknown>;

export type AnalyticsSnapshot = {
  key: AnalyticsKey;
  connected: boolean;
  statusLabel: "LIVE" | "EMPTY" | "AVAILABLE";
  rowCount: number;
  amountMinor: number | null;
  currency: string | null;
  dspCodes: string[];
  note: string;
};

function providerCode(row: ProviderRow): string {
  return String(
    row.platform ??
      row.channel ??
      row.dsp ??
      row.store ??
      row.service ??
      row.platform_name ??
      ""
  ).trim();
}

function matchesKey(dsp: string | null, key: AnalyticsKey): boolean {
  if (!dsp) return false;
  const configured = ANALYTICS_DSP_MATCH[key] ?? [];
  if (configured.length === 0) return true;
  const needle = dsp.toLowerCase();
  return configured.some((code) => needle === code || needle.includes(code));
}

function codesFor(rows: ProviderRow[]): string[] {
  return [...new Set(rows.map(providerCode).filter(Boolean))];
}

async function providerRowsForKey(ownerUserId: string, key: AnalyticsKey): Promise<ProviderRow[]> {
  switch (key) {
    case "streams":
    case "analytics_overview":
    case "usage_discovery":
    case "insights":
    case "audience":
    case "reports_stream_data":
    case "reports_raw_data":
      return await ownedAnalytics(ownerUserId);
    case "sales_releases":
    case "by_release":
    case "reports_catalog":
      return await ownedSales(ownerUserId, "releases");
    case "sales_tracks":
      return await ownedSales(ownerUserId, "tracks");
    case "sales_stores":
    case "by_platform":
      return await ownedSales(ownerUserId, "channels");
    case "sales_artists":
      return await ownedSales(ownerUserId, "artists");
    case "sales_territories":
      return await ownedSales(ownerUserId, "territories");
    case "stream_rate":
      return await ownedSales(ownerUserId, "streamRates");
    case "sales_overview":
    case "sales_monthly":
    case "reports_overview":
    case "reports_sales":
      return await ownedSales(ownerUserId, "overview");
    default: {
      const rows = await ownedSales(ownerUserId, "overview");
      return rows.filter((row) => matchesKey(providerCode(row), key));
    }
  }
}

async function localReportSnapshot(
  ownerUserId: string,
  key: AnalyticsKey
): Promise<AnalyticsSnapshot | null> {
  const db = await createClient();

  if (key === "reports_catalog") {
    const [{ count: releases }, { count: tracks }] = await Promise.all([
      db.from("releases").select("id", { count: "exact", head: true }).eq("owner_user_id", ownerUserId),
      db
        .from("release_tracks")
        .select("id,releases!inner(owner_user_id)", { count: "exact", head: true })
        .eq("releases.owner_user_id", ownerUserId),
    ]);
    return {
      key,
      connected: true,
      statusLabel: (releases ?? 0) + (tracks ?? 0) > 0 ? "LIVE" : "EMPTY",
      rowCount: (releases ?? 0) + (tracks ?? 0),
      amountMinor: null,
      currency: null,
      dspCodes: [],
      note: `${releases ?? 0} releases · ${tracks ?? 0} tracks in the Nexo catalog.`,
    };
  }

  if (key === "reports_payouts") {
    const { data, error } = await db
      .from("payouts")
      .select("amount_minor,currency,status")
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) return null;
    const rows = data ?? [];
    const currencies = [...new Set(rows.map((row) => String(row.currency).trim()))];
    return {
      key,
      connected: true,
      statusLabel: rows.length ? "LIVE" : "EMPTY",
      rowCount: rows.length,
      amountMinor:
        currencies.length === 1
          ? rows.reduce((sum, row) => sum + Number(row.amount_minor || 0), 0)
          : null,
      currency: currencies.length === 1 ? currencies[0] : null,
      dspCodes: [...new Set(rows.map((row) => String(row.status)).filter(Boolean))],
      note: rows.length
        ? "Payout reporting comes from Nexo Finance records."
        : "No payout records are available yet.",
    };
  }

  if (key === "reports_release_links") {
    const { data, error } = await db
      .from("fanlinks")
      .select("id,resolution_status")
      .eq("owner_user_id", ownerUserId)
      .limit(1000);
    if (error) return null;
    const rows = data ?? [];
    return {
      key,
      connected: true,
      statusLabel: rows.length ? "LIVE" : "EMPTY",
      rowCount: rows.length,
      amountMinor: null,
      currency: null,
      dspCodes: [...new Set(rows.map((row) => String(row.resolution_status)).filter(Boolean))],
      note: rows.length
        ? "Release-link reporting comes from your Nexo Fanlinks."
        : "No release links are available yet.",
    };
  }

  if (key === "reports_additional") {
    const { data, error } = await db
      .from("royalty_statements")
      .select("id,status,currency")
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return null;
    const rows = data ?? [];
    return {
      key,
      connected: true,
      statusLabel: rows.length ? "LIVE" : "EMPTY",
      rowCount: rows.length,
      amountMinor: null,
      currency: null,
      dspCodes: [...new Set(rows.map((row) => String(row.status)).filter(Boolean))],
      note: rows.length
        ? "Additional reporting includes published Nexo royalty statements."
        : "No additional statements are available yet.",
    };
  }

  if (key === "reports_overview") {
    const [{ count: releases }, { count: payouts }, { count: fanlinks }] = await Promise.all([
      db.from("releases").select("id", { count: "exact", head: true }).eq("owner_user_id", ownerUserId),
      db.from("payouts").select("id", { count: "exact", head: true }).eq("owner_user_id", ownerUserId),
      db.from("fanlinks").select("id", { count: "exact", head: true }).eq("owner_user_id", ownerUserId),
    ]);
    const total = (releases ?? 0) + (payouts ?? 0) + (fanlinks ?? 0);
    return {
      key,
      connected: true,
      statusLabel: total ? "LIVE" : "EMPTY",
      rowCount: total,
      amountMinor: null,
      currency: null,
      dspCodes: [],
      note: `${releases ?? 0} releases · ${fanlinks ?? 0} release links · ${payouts ?? 0} payout records.`,
    };
  }

  return null;
}

export async function loadAnalyticsSnapshot(
  ownerUserId: string,
  key: AnalyticsKey
): Promise<AnalyticsSnapshot> {
  const localFirst = await localReportSnapshot(ownerUserId, key);
  if (localFirst) return localFirst;

  try {
    const providerRows = await providerRowsForKey(ownerUserId, key);
    if (providerRows.length > 0) {
      return {
        key,
        connected: true,
        statusLabel: "LIVE",
        rowCount: providerRows.length,
        amountMinor: null,
        currency: null,
        dspCodes: codesFor(providerRows),
        note: "Live Distribution Engine data is available for releases owned by this account.",
      };
    }
  } catch {
    // Continue to Nexo ledger fallback.
  }

  const db = await createClient();
  const { data, error } = await db
    .from("ledger_entries")
    .select("id,amount_minor,currency,dsp_code,kind")
    .eq("owner_user_id", ownerUserId)
    .limit(5000);

  if (error) {
    return {
      key,
      connected: false,
      statusLabel: "AVAILABLE",
      rowCount: 0,
      amountMinor: null,
      currency: null,
      dspCodes: [],
      note: "The feature is available, but verified rows could not be loaded right now.",
    };
  }

  const raw = data ?? [];
  const configured = ANALYTICS_DSP_MATCH[key] ?? [];
  const rows =
    configured.length === 0
      ? raw
      : raw.filter((row) => matchesKey(row.dsp_code as string | null, key));
  const codes = [...new Set(rows.map((row) => String(row.dsp_code || "")).filter(Boolean))];
  const currencies = [...new Set(rows.map((row) => String(row.currency || "")).filter(Boolean))];
  const amountMinor =
    currencies.length <= 1
      ? rows.reduce((sum, row) => sum + Number(row.amount_minor || 0), 0)
      : null;
  const currency = currencies.length === 1 ? currencies[0] : null;

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
          ? "Spotify Discovery Mode is available through Nexo. No verified enrollment or activity rows are available yet."
          : key === "streamsafe"
            ? "StreamSafe is available through Nexo. No verified suspicious-stream flags are available."
            : "No verified rows are available for this view yet.",
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
    note: "Figures come from posted Nexo ledger rows when live provider rows are unavailable.",
  };
}
