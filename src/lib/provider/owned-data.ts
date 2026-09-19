import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  distributionReference,
  providerAnalyticsRows,
  providerRows,
  type ProviderSalesPageQuery,
} from "@/lib/provider/distribution-reference";

type Row = Record<string, unknown>;

type LocalTrackScope = {
  title: string | null;
  isrc: string | null;
};

type LocalReleaseScope = {
  id: string;
  provider_release_id: string | null;
  title: string | null;
  upc: string | null;
  primary_artist_name: string | null;
  release_tracks?: LocalTrackScope[] | null;
};

function positiveId(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v ? v : null;
}

function numberValue(row: Row, keys: string[]): number | null {
  for (const key of keys) {
    const raw = row[key];
    const value =
      typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function releaseIdFromRow(row: Row): string {
  return String(
    row.release_id ??
      row.releaseId ??
      row.provider_release_id ??
      row.providerReleaseId ??
      row.id ??
      ""
  ).trim();
}

function isrcFromRow(row: Row): string {
  return String(row.isrc ?? row.ISRC ?? row.track_isrc ?? "").trim().toUpperCase();
}

function analyticsReleaseIdFromRow(row: Row): string {
  return String(
    row.release_id ??
      row.releaseId ??
      row.provider_release_id ??
      row.providerReleaseId ??
      ""
  ).trim();
}


function annotate(rows: Row[], extra: Row): Row[] {
  return rows.map((row) => ({ ...row, ...extra }));
}

async function settleRows(
  taskFactories: Array<() => Promise<unknown>>,
  concurrency = 5
): Promise<Row[]> {
  const out: Row[] = [];
  const failures: unknown[] = [];
  let fulfilled = 0;

  for (let start = 0; start < taskFactories.length; start += concurrency) {
    const batch = taskFactories.slice(start, start + concurrency);
    const settled = await Promise.allSettled(batch.map((run) => run()));

    for (const result of settled) {
      if (result.status === "fulfilled") {
        fulfilled += 1;
        out.push(...providerRows(result.value));
      } else {
        failures.push(result.reason);
      }
    }

    const fatal = failures.find(isFatalProviderFailure);
    if (fatal) throw fatal;
  }

  // A completely failed request set is an upstream error, not an empty sales report.
  if (taskFactories.length > 0 && fulfilled === 0 && failures.length > 0) {
    throw failures[0];
  }

  return out;
}

function isFatalProviderFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /authorization is unavailable/i.test(message) ||
    /HTTP\s+(401|403|429)\b/i.test(message) ||
    /quota remaining:\s*0/i.test(message)
  );
}

async function paginated(
  getter: (query: ProviderSalesPageQuery) => Promise<unknown>,
  maxPages = 5
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const raw = await getter({ page, perPage: 100 });
    const current = providerRows(raw);
    rows.push(...current);

    const outer = raw && typeof raw === "object" ? (raw as Row) : {};
    const currentPage = Number(outer.currentPage ?? page);
    const totalPages = Number(outer.totalPages ?? currentPage);
    if (!Number.isFinite(totalPages) || currentPage >= totalPages || current.length === 0) {
      break;
    }
  }
  return rows;
}

function sumTotals(rows: Row[]): number | null {
  let total = 0;
  let hasValue = false;
  for (const row of rows) {
    const value = numberValue(row, [
      "total",
      "dividends",
      "amount",
      "earnings",
      "revenue",
      "net",
      "royalty",
      "royalties",
    ]);
    if (value != null) {
      total += value;
      hasValue = true;
    }
  }
  return hasValue ? total : null;
}

function latestDate(rows: Row[]): string | null {
  const dates = rows
    .map((row) => String(row.date ?? row.month ?? row.period ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
  return dates[0] ?? null;
}

function aggregateBy(
  rows: Row[],
  keyOf: (row: Row) => string,
  decorate: (key: string, first: Row) => Row
): Row[] {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const key = keyOf(row).trim();
    if (!key) continue;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  return [...grouped.entries()].map(([key, values]) => {
    const first = values[0] ?? {};
    const total = sumTotals(values);
    const streams = values.reduce(
      (sum, row) => sum + (numberValue(row, ["streams", "plays"]) ?? 0),
      0
    );
    const units = values.reduce(
      (sum, row) => sum + (numberValue(row, ["units", "quantity", "count"]) ?? 0),
      0
    );
    const hasStreams = values.some((row) => numberValue(row, ["streams", "plays"]) != null);
    const hasUnits = values.some(
      (row) => numberValue(row, ["units", "quantity", "count"]) != null
    );

    return {
      ...first,
      ...decorate(key, first),
      total,
      dividends: total,
      streams: hasStreams ? streams : undefined,
      units: hasUnits ? units : undefined,
      date: latestDate(values) ?? first.date,
    };
  });
}

export async function ownedDistributionScope(userId: string) {
  const db = await createClient();
  const { data: local } = await db
    .from("releases")
    .select("id,provider_release_id,title,upc,primary_artist_name,release_tracks(title,isrc)")
    .eq("owner_user_id", userId);

  const releases = (local ?? []) as unknown as LocalReleaseScope[];
  const releaseIds = releases.map((release) => release.id).filter(Boolean);

  let links: Array<{ release_id: string; provider_release_id: string | null }> = [];
  if (releaseIds.length > 0) {
    const { data } = await db
      .from("provider_release_links")
      .select("release_id,provider_release_id")
      .in("release_id", releaseIds)
      .eq("provider_name", "distribution_engine");
    links = (data ?? []) as Array<{ release_id: string; provider_release_id: string | null }>;
  }

  const linked = new Map(
    links
      .map((link) => [link.release_id, positiveId(link.provider_release_id)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
  );

  const providerIds = new Set<string>();
  const isrcs = new Set<string>();
  const artistNames = new Set<string>();
  const releaseByProviderId = new Map<string, LocalReleaseScope>();
  const trackByIsrc = new Map<string, LocalTrackScope>();

  for (const release of releases) {
    const providerId = positiveId(release.provider_release_id) ?? linked.get(release.id) ?? null;
    if (providerId) {
      providerIds.add(providerId);
      releaseByProviderId.set(providerId, release);
    }
    if (release.primary_artist_name?.trim()) {
      artistNames.add(release.primary_artist_name.trim());
    }
    for (const track of release.release_tracks ?? []) {
      if (!track.isrc) continue;
      const isrc = track.isrc.trim().toUpperCase();
      isrcs.add(isrc);
      if (!trackByIsrc.has(isrc)) trackByIsrc.set(isrc, track);
    }
  }

  return {
    local: releases,
    providerIds,
    isrcs,
    artistNames,
    releaseByProviderId,
    trackByIsrc,
  };
}

export type OwnedSalesKind =
  | "overview"
  | "monthlyOverview"
  | "tracks"
  | "releases"
  | "artists"
  | "channels"
  | "territories"
  | "streamRates";

/**
 * Reads only real upstream data and scopes account-sensitive sales to releases/tracks/artists
 * already owned by the signed-in Nexo user. Aggregate provider-wide sales are never exposed
 * directly to artist/label clients.
 */
export async function ownedSales(userId: string, kind: OwnedSalesKind): Promise<Row[]> {
  const scope = await ownedDistributionScope(userId);

  // Keep interactive calls bounded for TooLost burst/quota limits while using direct
  // owned-catalog endpoints so a user's rows cannot disappear behind provider-wide pagination.
  const providerIds = [...scope.providerIds].slice(0, 50);

  if (kind === "overview" || kind === "monthlyOverview") {
    if (providerIds.length === 0) return [];
    return settleRows(
      providerIds.map((providerReleaseId) => async () => {
        const raw = await distributionReference.salesReleaseOverview(providerReleaseId, {
          page: 1,
          perPage: 100,
        });
        return annotate(providerRows(raw), { provider_release_id: providerReleaseId });
      })
    );
  }

  if (kind === "channels") {
    if (providerIds.length === 0) return [];
    const rows = await settleRows(
      providerIds.map((providerReleaseId) => async () => {
        const raw = await distributionReference.salesReleaseChannels(providerReleaseId, {
          page: 1,
          perPage: 100,
        });
        return annotate(providerRows(raw), { provider_release_id: providerReleaseId });
      })
    );

    return aggregateBy(
      rows,
      (row) =>
        String(row.channel ?? row.platform ?? row.service ?? row.store ?? row.name ?? "").trim(),
      (channel, first) => ({
        channel,
        name: channel,
        logo: first.logo,
        logoDark: first.logoDark,
        logoDefault: first.logoDefault,
      })
    );
  }

  if (kind === "territories") {
    if (providerIds.length === 0) return [];
    const rows = await settleRows(
      providerIds.map((providerReleaseId) => async () => {
        const raw = await distributionReference.salesReleaseTerritories(providerReleaseId, {
          page: 1,
          perPage: 100,
        });
        return annotate(providerRows(raw), { provider_release_id: providerReleaseId });
      })
    );

    return aggregateBy(
      rows,
      (row) => String(row.territory ?? row.country ?? row.name ?? row.code ?? "").trim(),
      (territory, first) => ({
        territory,
        country: territory,
        code: first.code,
        flag: first.flag,
      })
    );
  }

  if (kind === "streamRates") {
    return paginated((query) => distributionReference.streamRates(query), 5);
  }

  if (kind === "releases") {
    if (providerIds.length === 0) return [];
    return settleRows(
      providerIds.map((providerReleaseId) => async () => {
        const raw = await distributionReference.salesReleaseOverview(providerReleaseId, {
          page: 1,
          perPage: 100,
        });
        const rows = providerRows(raw);
        if (rows.length === 0) return [];

        const local = scope.releaseByProviderId.get(providerReleaseId);
        const total = sumTotals(rows);
        return [
          {
            id: providerReleaseId,
            release_id: providerReleaseId,
            provider_release_id: providerReleaseId,
            title: local?.title ?? null,
            release_title: local?.title ?? null,
            upc: local?.upc ?? null,
            artist: local?.primary_artist_name ?? null,
            dividends: total,
            total,
            date: latestDate(rows),
          },
        ];
      })
    );
  }

  if (kind === "tracks") {
    const tracks = [...scope.trackByIsrc.entries()].slice(0, 100);
    if (tracks.length === 0) return [];

    return settleRows(
      tracks.map(([isrc, track]) => async () => {
        const raw = await distributionReference.salesTrackOverview(isrc, {
          page: 1,
          perPage: 100,
        });
        const rows = providerRows(raw);
        if (rows.length === 0) return [];

        const total = sumTotals(rows);
        return [
          {
            id: isrc,
            isrc,
            title: track.title ?? null,
            track_title: track.title ?? null,
            dividends: total,
            total,
            date: latestDate(rows),
          },
        ];
      })
    );
  }

  if (kind === "artists") {
    if (providerIds.length === 0) return [];

    const rows = await settleRows(
      providerIds.map((providerReleaseId) => async () => {
        const local = scope.releaseByProviderId.get(providerReleaseId);
        const artist = local?.primary_artist_name?.trim();
        if (!artist) return [];

        const raw = await distributionReference.salesReleaseOverview(providerReleaseId, {
          page: 1,
          perPage: 100,
        });
        return annotate(providerRows(raw), {
          provider_release_id: providerReleaseId,
          artist,
          artist_name: artist,
          name: artist,
        });
      })
    );

    return aggregateBy(
      rows,
      (row) => String(row.artist ?? row.artist_name ?? row.name ?? "").trim(),
      (artist) => ({
        id: artist,
        artist,
        artist_name: artist,
        name: artist,
      })
    );
  }

  return [];
}

export type OwnedAnalyticsResult = {
  rows: Row[];
  connected: boolean;
  hasCatalogScope: boolean;
  providerErrors: number;
};

/**
 * Returns live provider analytics that can be proven to belong to the signed-in
 * Nexo account. Aggregate provider-wide rows are never exposed unless they carry
 * an owned release id or ISRC. Track-detail calls are made only for locally-owned
 * ISRCs and are annotated with that ISRC before normalization.
 */
export async function ownedAnalytics(userId: string): Promise<OwnedAnalyticsResult> {
  const scope = await ownedDistributionScope(userId);
  const hasCatalogScope = scope.isrcs.size > 0 || scope.providerIds.size > 0;

  const aggregateRequests: Array<{
    source: string;
    run: () => Promise<unknown>;
  }> = [
    { source: "tracks", run: () => distributionReference.analyticsTracks() },
    { source: "track_charts", run: () => distributionReference.analyticsTrackCharts() },
  ];

  const aggregateSettled = await Promise.allSettled(
    aggregateRequests.map((request) => request.run())
  );

  let connected = aggregateSettled.some((result) => result.status === "fulfilled");
  let providerErrors = aggregateSettled.filter((result) => result.status === "rejected").length;

  const ownedAggregateRows = aggregateSettled.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    const source = aggregateRequests[index]?.source ?? "analytics";
    return providerAnalyticsRows(result.value, { _analytics_source: source }).filter((row) => {
      const releaseId = analyticsReleaseIdFromRow(row);
      const isrc = isrcFromRow(row);
      return (
        (Boolean(releaseId) && scope.providerIds.has(releaseId)) ||
        (Boolean(isrc) && scope.isrcs.has(isrc))
      );
    });
  });

  const representedIsrcs = new Set(
    ownedAggregateRows.map((row) => isrcFromRow(row)).filter(Boolean)
  );

  // Detail endpoints are the safest way to expose nested platform metrics because
  // the request itself is scoped to an ISRC owned by this Nexo user. Limit one
  // interactive render to 50 detail calls to stay inside provider burst/quota limits.
  const detailIsrcs = [...scope.isrcs]
    .filter((isrc) => !representedIsrcs.has(isrc))
    .slice(0, 50);

  const detailRows: Row[] = [];
  for (let startIndex = 0; startIndex < detailIsrcs.length; startIndex += 5) {
    const batch = detailIsrcs.slice(startIndex, startIndex + 5);
    const settled = await Promise.allSettled(
      batch.map(async (isrc) => {
        const raw = await distributionReference.analyticsTrack(isrc);
        return providerAnalyticsRows(raw, {
          isrc,
          _analytics_source: "track_detail",
        });
      })
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        connected = true;
        detailRows.push(...result.value);
      } else {
        providerErrors += 1;
      }
    }
  }

  const seen = new Set<string>();
  const rows = [...detailRows, ...ownedAggregateRows].filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    rows,
    connected,
    hasCatalogScope,
    providerErrors,
  };
}

