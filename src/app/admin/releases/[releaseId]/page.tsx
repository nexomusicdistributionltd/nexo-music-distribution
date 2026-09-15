import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { QcDecisionForm } from "@/components/admin/QcDecisionForm";
import { TrackPlayer } from "@/components/admin/TrackPlayer";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { getReleaseDetail } from "@/lib/releases/queries";
import { createSignedAssetUrl } from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";
import { isQcableStatus } from "@/lib/admin/qc";
import { evaluateReleaseReadiness } from "@/lib/ddex/readiness";
import { DdexReadinessPanel } from "@/components/ddex/DdexReadinessPanel";
import { getProviderConnectionState } from "@/lib/provider";

export const metadata: Metadata = {
  title: "Release review",
  robots: { index: false, follow: false },
};

function fmtTs(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function AdminReleaseDetailPage({
  params,
}: {
  params: Promise<{ releaseId: string }>;
}) {
  await RequireAdminPermission("admin:releases");
  const { releaseId } = await params;
  const detail = await getReleaseDetail(releaseId);
  if (!detail) notFound();

  const { release, tracks, contributors, assets, history } = detail;
  const provider = getProviderConnectionState();
  const artwork = assets.find((a) => a.kind === "artwork");
  const artworkUrl = artwork
    ? await createSignedAssetUrl(artwork.storage_bucket, artwork.storage_path, 300)
    : null;

  const trackPlayers = await Promise.all(
    tracks.map(async (t) => {
      const audio =
        assets.find((a) => a.kind === "audio" && a.track_id === t.id) ??
        assets.find((a) => a.kind === "audio" && !a.track_id);
      const url = audio
        ? await createSignedAssetUrl(audio.storage_bucket, audio.storage_path, 300)
        : null;
      const trackContributors = contributors
        .filter((c) => c.track_id === t.id || c.track_id == null)
        .filter((c) => c.track_id === t.id)
        .map((c) => ({ name: c.name, role: c.role }));
      const releaseLevel = contributors
        .filter((c) => c.track_id == null)
        .map((c) => ({ name: c.name, role: c.role }));
      return {
        track: t,
        url,
        contributors: trackContributors.length > 0 ? trackContributors : releaseLevel,
      };
    })
  );

  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("qc_reviews")
    .select("*")
    .eq("release_id", releaseId)
    .order("created_at", { ascending: false });

  const catalogNumber =
    typeof release.distribution_settings?.catalog_number === "string"
      ? release.distribution_settings.catalog_number
      : typeof release.distribution_settings?.catalogNumber === "string"
        ? release.distribution_settings.catalogNumber
        : null;

  const { data: deals } = await supabase
    .from("release_deals")
    .select("territories, use_types, commercial_model_types, validity_start, validity_end")
    .eq("release_id", releaseId);

  const readiness = evaluateReleaseReadiness({
    upc: release.upc,
    copyright_line: release.copyright_line,
    phonogram_line: release.phonogram_line,
    artist_profile_id: release.artist_profile_id,
    primary_artist_name: release.primary_artist_name,
    genre: release.genre,
    territories: release.territories,
    release_date: release.release_date,
    tracks,
    contributors,
    assets,
    deals: deals ?? [],
  });

  const notes =
    release.description ||
    (typeof release.distribution_settings?.notes === "string"
      ? release.distribution_settings.notes
      : null);

  const metaRows: [string, string][] = [
    ["Title", release.title || "—"],
    ["Version", release.version || "—"],
    ["Type", release.release_type],
    ["Primary artist", release.primary_artist_name || "—"],
    ["Label", release.label_name || "—"],
    ["Genre", release.genre || "—"],
    ["Subgenre", release.subgenre || "—"],
    ["Language", release.language || "—"],
    ["Release date", release.release_date || "—"],
    ["Original release date", release.original_release_date || "—"],
    ["Copyright year", release.copyright_year != null ? String(release.copyright_year) : "—"],
    ["Copyright", release.copyright_line || "—"],
    ["Phonogram", release.phonogram_line || "—"],
    ["Territories", (release.territories || []).join(", ") || "—"],
    ["UPC", release.upc || "—"],
    ["Catalog", catalogNumber || "—"],
    ["Explicit", release.explicit ? "Yes" : "No"],
    ["Status", release.status],
    ["Submitted at", fmtTs(release.submitted_at)],
    ["Locked at", fmtTs(release.locked_at)],
    ["Created at", fmtTs(release.created_at)],
    ["Updated at", fmtTs(release.updated_at)],
    ["Provider connected", release.provider_connected ? "Yes" : "No"],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={release.title || "Untitled release"}
        description={`${release.primary_artist_name} · ${release.release_type}${release.version ? ` · ${release.version}` : ""}`}
      />
      <ProviderBanner connected={provider.connected} />
      <div className="flex flex-wrap items-center gap-3">
        <ReleaseStatusBadge status={release.status} />
        {release.upc ? <span className="text-caption">UPC {release.upc}</span> : null}
        {release.release_date ? (
          <span className="text-caption">Release {release.release_date}</span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5">
          <h2 className="text-h4">Complete release metadata</h2>
          <dl className="grid grid-cols-2 gap-2 text-small">
            {metaRows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[var(--nexo-text-muted)]">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {notes ? (
            <div>
              <h3 className="text-label">Notes</h3>
              <p className="text-small text-[var(--nexo-text-secondary)]">{notes}</p>
            </div>
          ) : (
            <p className="text-caption text-[var(--nexo-text-muted)]">No notes.</p>
          )}
          {release.changes_requested_reason ? (
            <p className="text-small">Changes requested: {release.changes_requested_reason}</p>
          ) : null}
          {release.rejection_reason ? (
            <p className="text-small">Rejection: {release.rejection_reason}</p>
          ) : null}
          {artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artworkUrl}
              alt="Release artwork"
              className="mt-3 aspect-square w-48 rounded-[var(--nexo-radius)] object-cover"
            />
          ) : (
            <p className="text-caption text-[var(--nexo-text-muted)]">No artwork uploaded.</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-h4">Tracks</h2>
          {trackPlayers.length === 0 ? (
            <p className="text-small text-[var(--nexo-text-muted)]">No tracks.</p>
          ) : (
            trackPlayers.map(({ track, url, contributors: trackCons }) => (
              <TrackPlayer
                key={track.id}
                trackNumber={track.track_number}
                title={track.title}
                version={track.version}
                isrc={track.isrc}
                explicit={track.explicit}
                language={track.language}
                durationMs={track.duration_ms}
                lyrics={track.lyrics}
                contributors={trackCons}
                signedUrl={url}
              />
            ))
          )}
          <h3 className="pt-2 text-label">All contributors</h3>
          {contributors.length === 0 ? (
            <p className="text-caption text-[var(--nexo-text-muted)]">None listed.</p>
          ) : (
            <ul className="space-y-1 text-small">
              {contributors.map((c) => (
                <li key={c.id}>
                  {c.name} · {c.role}
                  {c.track_id ? " (track)" : " (release)"}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <DdexReadinessPanel report={readiness} />
      <p className="text-small">
        <Link className="underline-offset-4 hover:underline" href={`/admin/ddex/${release.id}`}>
          Open DDEX ERN 4.3.2 operations
        </Link>
      </p>

      {isQcableStatus(release.status) ? <QcDecisionForm releaseId={release.id} /> : null}

      <section className="space-y-2">
        <h2 className="text-h4">QC reviews (staff only)</h2>
        {(reviews ?? []).length === 0 ? (
          <p className="text-small text-[var(--nexo-text-muted)]">No QC reviews yet.</p>
        ) : (
          <ul className="space-y-2 text-small">
            {(reviews ?? []).map(
              (r: {
                id: string;
                decision: string;
                artist_visible_reason: string | null;
                internal_note: string | null;
                created_at: string;
                reviewer_user_id: string;
              }) => (
                <li
                  key={r.id}
                  className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3"
                >
                  <p className="font-medium">
                    {r.decision} · {new Date(r.created_at).toLocaleString()}
                  </p>
                  {r.artist_visible_reason ? (
                    <p className="mt-1">Artist reason: {r.artist_visible_reason}</p>
                  ) : null}
                  {r.internal_note ? (
                    <p className="mt-1 text-[var(--nexo-text-muted)]">
                      Internal: {r.internal_note}
                    </p>
                  ) : null}
                </li>
              )
            )}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-h4">Status history</h2>
        <ul className="space-y-1 text-small">
          {history.map((h) => (
            <li key={h.id}>
              {h.previous_status ?? "—"} → {h.new_status} · {fmtTs(h.created_at)}
              {h.reason ? ` · ${h.reason}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
