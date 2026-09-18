import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  distributionReference,
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

export async function ownedAnalytics(userId: string): Promise<Row[]> {
  const scope = await ownedDistributionScope(userId);
  if (!scope.isrcs.size && !scope.providerIds.size) return [];

  // Global analytics resources can contain distributor-wide rows, so those rows
  // are filtered back to identifiers owned by this account. Each endpoint is
  // source-tagged so downstream normalization can select one metric source per
  // DSP instead of double-counting overlapping analytics resources.
  const globalSources = [
    { source: "analytics_overview", load: () => distributionReference.analyticsOverview() },
    { source: "analytics_tracks", load: () => distributionReference.analyticsTracks() },
    { source: "analytics_platform_data", load: () => distributionReference.analyticsPlatformData() },
  ] as const;

  const [globalSettled, trackRows] = await Promise.all([
    Promise.allSettled(globalSources.map((entry) => entry.load())),
    settleRows(
      [...scope.isrcs].slice(0, 50).map((isrc) => async () => {
        const raw = await distributionReference.analyticsTrack(isrc);
        return annotate(providerRows(raw), {
          isrc,
          analytics_source: "analytics_track_detail",
        });
      }),
      4
    ),
  ]);

  const globalSucceeded = globalSettled.some((result) => result.status === "fulfilled");
  if (!globalSucceeded && trackRows.length === 0) {
    const firstFailure = globalSettled.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (firstFailure?.reason instanceof Error) throw firstFailure.reason;
    throw new Error("Distribution analytics provider is unavailable.");
  }

  const globalRows = globalSettled
    .flatMap((result, index) =>
      result.status === "fulfilled"
        ? annotate(providerRows(result.value), {
            analytics_source: globalSources[index]?.source ?? "analytics",
          })
        : []
    )
    .filter((row) => {
      const releaseId = releaseIdFromRow(row);
      const isrc = isrcFromRow(row);
      return (
        (Boolean(releaseId) && scope.providerIds.has(releaseId)) ||
        (Boolean(isrc) && scope.isrcs.has(isrc))
      );
    });

  const seen = new Set<string>();
  return [...trackRows, ...globalRows].filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
