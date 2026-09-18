"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CoverArt } from "@/components/workspace/CoverArt";
import { Alert } from "@/components/ui/Alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { ReleaseRowActions } from "@/components/releases/ReleaseRowActions";
import type {
  ReleaseAssetRow,
  ReleaseContributorRow,
  ReleaseRow,
  ReleaseStatus,
  ReleaseStatusHistoryRow,
  ReleaseTrackRow,
} from "@/lib/releases/types";

export type ReleaseDetailTab =
  | "overview"
  | "tracks"
  | "metadata"
  | "contributors"
  | "assets"
  | "distribution"
  | "publishing"
  | "history"
  | "ddex";

export function ReleaseDetailView({
  release,
  tracks,
  contributors,
  assets,
  history,
  artworkUrl,
  variant,
  actions,
  extra,
  ddexPanel,
  qcPanel,
}: {
  release: ReleaseRow;
  tracks: ReleaseTrackRow[];
  contributors: ReleaseContributorRow[];
  assets: ReleaseAssetRow[];
  history: ReleaseStatusHistoryRow[];
  artworkUrl?: string | null;
  variant: "portal" | "admin";
  actions?: ReactNode;
  extra?: ReactNode;
  ddexPanel?: ReactNode;
  qcPanel?: ReactNode;
}) {
  const showDdex = Boolean(ddexPanel);
  const publishers = contributors.filter((c) => c.role === "publisher");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <CoverArt src={artworkUrl} title={release.title || "Untitled"} size={88} className="rounded-[var(--nexo-radius)]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-h3">{release.title || "Untitled draft"}</h2>
            <ReleaseStatusBadge status={release.status as ReleaseStatus} />
          </div>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            {release.primary_artist_name} · {release.release_type}
            {release.release_date ? ` · ${release.release_date}` : ""}
            {release.upc ? ` · UPC ${release.upc}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {variant === "portal" ? (
            <ReleaseRowActions id={release.id} status={release.status as ReleaseStatus} />
          ) : null}
        </div>
      </div>

      {release.status === "changes_requested" && release.changes_requested_reason ? (
        <Alert variant="error" title="Declined — changes required">
          {release.changes_requested_reason}
        </Alert>
      ) : null}
      {release.status === "rejected" && release.rejection_reason ? (
        <Alert variant="error" title="Rejected">
          {release.rejection_reason}
        </Alert>
      ) : null}

      {qcPanel}

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tracks">Tracks</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="contributors">Contributors</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="publishing">Publishing</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          {showDdex ? (
            <TabsTrigger value="ddex">{variant === "admin" ? "DDEX" : "Delivery status"}</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Meta label="Title" value={release.title || "—"} />
            <Meta label="Primary artist" value={release.primary_artist_name || "—"} />
            <Meta label="Type" value={release.release_type} />
            <Meta label="Genre" value={release.genre || "—"} />
            <Meta label="Label" value={release.label_name || "—"} />
            <Meta label="UPC" value={release.upc || "Not provided"} />
            <Meta label="Release date" value={release.release_date || "—"} />
            <Meta label="Tracks" value={String(tracks.length)} />
          </dl>
        </TabsContent>

        <TabsContent value="tracks">
          {tracks.length === 0 ? (
            <p className="text-small text-[var(--nexo-text-muted)]">No tracks yet.</p>
          ) : (
            <ol className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius)] border border-[var(--nexo-border)]">
              {tracks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-small">
                  <span>
                    <span className="mr-2 tabular-nums text-[var(--nexo-text-muted)]">{t.track_number}.</span>
                    {t.title || "Untitled"}
                    {t.version ? <span className="text-[var(--nexo-text-muted)]"> ({t.version})</span> : null}
                  </span>
                  <span className="font-mono text-caption text-[var(--nexo-text-muted)]">
                    {t.isrc || "no ISRC"}
                    {t.duration_ms
                      ? ` · ${Math.floor(t.duration_ms / 60000)}:${String(Math.floor((t.duration_ms / 1000) % 60)).padStart(2, "0")}`
                      : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="metadata">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Meta label="Version" value={release.version || "—"} />
            <Meta label="Subgenre" value={release.subgenre || "—"} />
            <Meta label="Language" value={release.language || "—"} />
            <Meta label="Original date" value={release.original_release_date || "—"} />
            <Meta label="Copyright year" value={release.copyright_year != null ? String(release.copyright_year) : "—"} />
            <Meta label="Copyright" value={release.copyright_line || "—"} />
            <Meta label="Phonogram" value={release.phonogram_line || "—"} />
            <Meta label="Territories" value={(release.territories ?? []).join(", ") || "—"} />
            <Meta label="Explicit" value={release.explicit ? "Yes" : "No"} />
            <Meta label="Description" value={release.description || "—"} />
          </dl>
        </TabsContent>

        <TabsContent value="contributors">
          {contributors.length === 0 ? (
            <p className="text-small text-[var(--nexo-text-muted)]">No contributors listed.</p>
          ) : (
            <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius)] border border-[var(--nexo-border)]">
              {contributors.map((c) => (
                <li key={c.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-small">
                  <span>{c.name}</span>
                  <span className="text-caption capitalize text-[var(--nexo-text-muted)]">
                    {c.role.replace(/_/g, " ")}
                    {c.ipi_cae ? ` · IPI ${c.ipi_cae}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="assets">
          {assets.length === 0 ? (
            <p className="text-small text-[var(--nexo-text-muted)]">No assets uploaded.</p>
          ) : (
            <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius)] border border-[var(--nexo-border)]">
              {assets.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-small">
                  <span className="capitalize">{a.kind}</span>
                  <span className="text-caption text-[var(--nexo-text-muted)]">{a.filename}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="distribution">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Meta label="Status" value={release.status.replace(/_/g, " ")} />
            {variant === "admin" ? (
              <>
                <Meta
                  label="Distribution Engine"
                  value={release.provider_status ? "Delivery active" : "Ready for delivery"}
                />
                <Meta label="Engine status" value={release.provider_status || "—"} />
              </>
            ) : (
              <Meta label="Delivery status" value={release.provider_status || release.status.replace(/_/g, " ")} />
            )}
            <Meta label="Territories" value={(release.territories ?? []).join(", ") || "—"} />
          </dl>
        </TabsContent>

        <TabsContent value="publishing">
          {publishers.length === 0 && !release.copyright_line ? (
            <p className="text-small text-[var(--nexo-text-muted)]">
              No publishing metadata on this release. Registration and collections are not claimed without a connected source.
            </p>
          ) : (
            <div className="space-y-3 text-small">
              <Meta label="Copyright" value={release.copyright_line || "—"} />
              <Meta label="Phonogram" value={release.phonogram_line || "—"} />
              {publishers.length ? (
                <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius)] border border-[var(--nexo-border)]">
                  {publishers.map((p) => (
                    <li key={p.id} className="px-4 py-3">
                      {p.name}
                      {p.share_percent != null ? ` · ${p.share_percent}%` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {history.length === 0 ? (
            <p className="text-small text-[var(--nexo-text-muted)]">No transitions yet.</p>
          ) : (
            <ol className="space-y-2 text-small">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-2">
                  <span className="text-[var(--nexo-text-muted)]">
                    {new Date(h.created_at).toLocaleString()}
                  </span>
                  <span>
                    {h.previous_status ?? "—"} → {h.new_status}
                  </span>
                  {h.reason ? <span className="text-[var(--nexo-text-muted)]">({h.reason})</span> : null}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        {showDdex ? <TabsContent value="ddex">{ddexPanel}</TabsContent> : null}
      </Tabs>

      {extra}

      {variant === "admin" ? (
        <p className="text-caption text-[var(--nexo-text-muted)]">
          <Link href="/admin/ddex" className="underline-offset-4 hover:underline">
            DDEX operations
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">{label}</dt>
      <dd className="mt-0.5 text-small">{value}</dd>
    </div>
  );
}
