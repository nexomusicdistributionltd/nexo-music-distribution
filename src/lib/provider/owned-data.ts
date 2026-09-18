import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  distributionReference,
  providerAnalyticsRows,
  providerRows,
  type ProviderSalesPageQuery,
} from "@/lib/provider/distribution-reference";

type Row = Record<string, unknown>;

type LocalReleaseScope = {
  id: string;
  provider_release_id: string | null;
  primary_artist_name: string | null;
  release_tracks?: Array<{ isrc: string | null }> | null;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function positiveId(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v ? v : null;
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

function artistFromRow(row: Row): string {
  return normalize(
    row.artist ??
      row.artist_name ??
      row.artistName ??
      row.primary_artist ??
      row.primaryArtist ??
      row.name
  );
}

function annotate(rows: Row[], extra: Row): Row[] {
  return rows.map((row) => ({ ...row, ...extra }));
}

async function settleRows(
  taskFactories: Array<() => Promise<unknown>>,
  concurrency = 5
): Promise<Row[]> {
  const out: Row[] = [];
  for (let start = 0; start < taskFactories.length; start += concurrency) {
    const batch = taskFactories.slice(start, start + concurrency);
    const settled = await Promise.allSettled(batch.map((run) => run()));
    out.push(
      ...settled.flatMap((result) =>
        result.status === "fulfilled" ? providerRows(result.value) : []
      )
    );
  }
  return out;
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

export async function ownedDistributionScope(userId: string) {
  const db = await createClient();
  const { data: local } = await db
    .from("releases")
    .select("id,provider_release_id,primary_artist_name,release_tracks(isrc)")
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

  for (const release of releases) {
    const providerId = positiveId(release.provider_release_id) ?? linked.get(release.id) ?? null;
    if (providerId) providerIds.add(providerId);
    if (release.primary_artist_name) artistNames.add(normalize(release.primary_artist_name));
    for (const track of release.release_tracks ?? []) {
      if (track.isrc) isrcs.add(track.isrc.trim().toUpperCase());
    }
  }

  return { local: releases, providerIds, isrcs, artistNames };
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
  if (!scope.providerIds.size && kind !== "streamRates") return [];

  // The public API has burst limits. Cap one interactive view to 50 release-scoped calls
  // and process them in small batches; additional releases remain available on release/track lists.
  const providerIds = [...scope.providerIds].slice(0, 50);

  if (kind === "overview" || kind === "monthlyOverview") {
    const rows = await settleRows(
      providerIds.map((providerReleaseId) => async () => {
        const raw = await distributionReference.salesReleaseOverview(providerReleaseId, {
          page: 1,
          perPage: 100,
        });
        return annotate(providerRows(raw), { provider_release_id: providerReleaseId });
      })
    );
    return rows;
  }

  if (kind === "channels") {
    return settleRows(
      providerIds.map((providerReleaseId) => async () => {
        const raw = await distributionReference.salesReleaseChannels(providerReleaseId, {
          page: 1,
          perPage: 100,
        });
        return annotate(providerRows(raw), { provider_release_id: providerReleaseId });
      })
    );
  }

  if (kind === "territories") {
    return settleRows(
      providerIds.map((providerReleaseId) => async () => {
        const raw = await distributionReference.salesReleaseTerritories(providerReleaseId, {
          page: 1,
          perPage: 100,
        });
        return annotate(providerRows(raw), { provider_release_id: providerReleaseId });
      })
    );
  }

  if (kind === "streamRates") {
    return paginated((query) => distributionReference.streamRates(query), 3);
  }

  if (kind === "releases") {
    const rows = await paginated((query) => distributionReference.salesReleases(query));
    return rows.filter((row) => scope.providerIds.has(releaseIdFromRow(row)));
  }

  if (kind === "tracks") {
    if (!scope.isrcs.size) return [];
    const rows = await paginated((query) => distributionReference.salesTracks(query));
    return rows.filter((row) => scope.isrcs.has(isrcFromRow(row)));
  }

  if (kind === "artists") {
    if (!scope.artistNames.size) return [];
    const rows = await paginated((query) => distributionReference.salesArtists(query));
    return rows.filter((row) => scope.artistNames.has(artistFromRow(row)));
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
    { source: "overview", run: () => distributionReference.analyticsOverview() },
    { source: "tracks", run: () => distributionReference.analyticsTracks() },
    { source: "track_charts", run: () => distributionReference.analyticsTrackCharts() },
    { source: "platform_data", run: () => distributionReference.analyticsPlatformData() },
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
      const releaseId = releaseIdFromRow(row);
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

