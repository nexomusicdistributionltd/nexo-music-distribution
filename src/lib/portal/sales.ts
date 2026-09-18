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
  streamRate: number | null;
  trendPercent: number | null;
};

export type SalesSnapshot = {
  key: SalesViewKey;
  rows: SalesDisplayRow[];
  status: "ready" | "empty" | "unavailable";
  note: string | null;
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
    "service",
    "store",
    "channel",
    "name",
  ]);
  const subtitle = stringValue(row, [
    "isrc",
    "upc",
    "catalog_number",
    "catalogNumber",
    "service",
    "store",
    "code",
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
      stringValue(row, ["id", "isrc", "upc", "date", "month", "code", "name"]) ??
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
      "dividends",
      "amount",
      "earnings",
      "revenue",
      "net",
      "royalty",
      "royalties",
    ]),
    currency: stringValue(row, ["currency", "currency_code", "currencyCode"]),
    streamRate: numberValue(row, [
      "stream_rate",
      "streamRate",
      "rate",
      "average_rate",
      "averageRate",
      "per_stream",
      "perStream",
      "value",
    ]),
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
    {
      total: number;
      streams: number;
      units: number;
      currency: string | null;
      hasTotal: boolean;
      hasStreams: boolean;
      hasUnits: boolean;
    }
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
    const total = numberValue(row, [
      "total",
      "dividends",
      "amount",
      "earnings",
      "revenue",
      "net",
      "royalty",
      "royalties",
    ]);
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
      streamRate: null,
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
    const rows =
      key === "monthly" || key === "overview"
        ? monthlyRows(raw)
        : raw.map((row, index) => normalizeRow(row, index));

    return {
      key,
      rows,
      status: rows.length > 0 ? "ready" : "empty",
      note: null,
    };
  } catch {
    return {
      key,
      rows: [],
      status: "unavailable",
      note:
        "Reporting is temporarily unavailable. Refresh the page in a moment or try again later.",
    };
  }
}

export const SALES_PAGE_COPY: Record<
  SalesViewKey,
  { title: string; description: string }
> = {
  overview: {
    title: "Sales Overview",
    description: "Latest reported sales and earnings activity for music in this account.",
  },
  releases: {
    title: "Sales by Release",
    description: "Reported earnings performance across your releases.",
  },
  tracks: {
    title: "Sales by Track",
    description: "Reported earnings performance across your tracks and ISRCs.",
  },
  channels: {
    title: "Stores / Services",
    description: "Reported performance across stores and streaming services.",
  },
  artists: {
    title: "Sales by Artist",
    description: "Reported sales and earnings across artists in this account.",
  },
  territories: {
    title: "Sales by Territory",
    description: "Reported performance by country and territory.",
  },
  monthly: {
    title: "Monthly Overviews",
    description: "Monthly reported totals across music in this account.",
  },
  stream_rates: {
    title: "Stream Rate",
    description: "Reported stream-rate data by month, service and territory.",
  },
};
