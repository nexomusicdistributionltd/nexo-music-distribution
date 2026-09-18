import "server-only";

import { ownedSales, type OwnedSalesKind } from "@/lib/provider/owned-data";

export type SalesViewKey =
  | "overview"
  | "releases"
  | "tracks"
  | "channels"
  | "artists"
  | "territories"
  | "monthly"
  | "stream_rates";

export type SalesDisplayRow = {
  id: string;
  date: string | null;
  title: string | null;
  subtitle: string | null;
  channel: string | null;
  territory: string | null;
  streams: number | null;
  units: number | null;
  total: number | null;
  currency: string | null;
  trendPercent: number | null;
};

export type SalesSnapshot = {
  key: SalesViewKey;
  rows: SalesDisplayRow[];
  connected: boolean;
  note: string;
};

function numberValue(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = row[key];
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function stringValue(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return null;
}

function normalizeRow(row: Record<string, unknown>, index: number): SalesDisplayRow {
  const title = stringValue(row, [
    "title",
    "release_title",
    "releaseTitle",
    "track_title",
    "trackTitle",
    "artist",
    "artist_name",
    "artistName",
    "name",
  ]);
  const subtitle = stringValue(row, [
    "isrc",
    "upc",
    "catalog_number",
    "catalogNumber",
    "service",
    "store",
  ]);
  const channel = stringValue(row, [
    "channel",
    "platform",
    "service",
    "store",
    "store_service",
    "storeService",
    "dsp",
  ]);
  const territory = stringValue(row, [
    "territory",
    "country",
    "country_name",
    "countryName",
    "country_code",
    "countryCode",
  ]);
  return {
    id:
      stringValue(row, ["id", "isrc", "upc", "date", "month"]) ??
      `row-${index}`,
    date: stringValue(row, ["date", "month", "period", "period_start", "periodStart"]),
    title,
    subtitle,
    channel,
    territory,
    streams: numberValue(row, [
      "streams",
      "stream_count",
      "streamCount",
      "plays",
      "play_count",
      "playCount",
    ]),
    units: numberValue(row, ["units", "quantity", "count", "downloads"]),
    total: numberValue(row, [
      "total",
      "amount",
      "earnings",
      "revenue",
      "net",
      "royalty",
      "royalties",
    ]),
    currency: stringValue(row, ["currency", "currency_code", "currencyCode"]),
    trendPercent: numberValue(row, [
      "trend_percent",
      "trendPercent",
      "change_percent",
      "changePercent",
      "percent_change",
      "percentChange",
    ]),
  };
}

function monthlyRows(rows: Record<string, unknown>[]): SalesDisplayRow[] {
  const grouped = new Map<
    string,
    { total: number; streams: number; units: number; currency: string | null; hasTotal: boolean; hasStreams: boolean; hasUnits: boolean }
  >();

  for (const row of rows) {
    const date = stringValue(row, ["date", "month", "period", "period_start", "periodStart"]);
    if (!date) continue;
    const existing = grouped.get(date) ?? {
      total: 0,
      streams: 0,
      units: 0,
      currency: null,
      hasTotal: false,
      hasStreams: false,
      hasUnits: false,
    };
    const total = numberValue(row, ["total", "amount", "earnings", "revenue", "net"]);
    const streams = numberValue(row, ["streams", "stream_count", "streamCount", "plays"]);
    const units = numberValue(row, ["units", "quantity", "count", "downloads"]);
    const currency = stringValue(row, ["currency", "currency_code", "currencyCode"]);

    if (total != null) {
      existing.total += total;
      existing.hasTotal = true;
    }
    if (streams != null) {
      existing.streams += streams;
      existing.hasStreams = true;
    }
    if (units != null) {
      existing.units += units;
      existing.hasUnits = true;
    }
    if (!existing.currency) existing.currency = currency;
    if (currency && existing.currency && currency !== existing.currency) existing.currency = null;
    grouped.set(date, existing);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, value]) => ({
      id: date,
      date,
      title: null,
      subtitle: null,
      channel: null,
      territory: null,
      streams: value.hasStreams ? value.streams : null,
      units: value.hasUnits ? value.units : null,
      total: value.hasTotal ? value.total : null,
      currency: value.currency,
      trendPercent: null,
    }));
}

const kindForKey: Record<SalesViewKey, OwnedSalesKind> = {
  overview: "overview",
  releases: "releases",
  tracks: "tracks",
  channels: "channels",
  artists: "artists",
  territories: "territories",
  monthly: "monthlyOverview",
  stream_rates: "streamRates",
};

export async function loadSalesSnapshot(
  ownerUserId: string,
  key: SalesViewKey
): Promise<SalesSnapshot> {
  try {
    const raw = await ownedSales(ownerUserId, kindForKey[key]);
    const rows = key === "monthly"
      ? monthlyRows(raw)
      : raw.map((row, index) => normalizeRow(row, index));

    return {
      key,
      rows,
      connected: true,
      note:
        rows.length > 0
          ? "Live provider sales data for catalog owned by this Nexo account. No values are estimated."
          : "The provider connection is available, but no sales rows are available for this account yet.",
    };
  } catch (error) {
    return {
      key,
      rows: [],
      connected: false,
      note:
        error instanceof Error
          ? error.message
          : "Distribution sales data is temporarily unavailable.",
    };
  }
}

export const SALES_PAGE_COPY: Record<
  SalesViewKey,
  { title: string; description: string }
> = {
  overview: {
    title: "Sales Overview",
    description: "Live sales and earnings rows scoped to releases owned by this account.",
  },
  releases: {
    title: "Sales by Release",
    description: "Provider sales reporting matched to your Nexo releases.",
  },
  tracks: {
    title: "Sales by Track",
    description: "Provider sales reporting matched to your catalog ISRCs.",
  },
  channels: {
    title: "Stores / Services",
    description: "Store and service performance returned for your releases.",
  },
  artists: {
    title: "Sales by Artist",
    description: "Provider artist sales rows matched to artists in your Nexo account.",
  },
  territories: {
    title: "Sales by Territory",
    description: "Territory reporting returned for your releases.",
  },
  monthly: {
    title: "Monthly Overviews",
    description: "Monthly provider totals aggregated only from releases owned by this account.",
  },
  stream_rates: {
    title: "Stream Rate",
    description: "Provider-reported stream-rate reference data. Rates are not converted into estimated royalties.",
  },
};
