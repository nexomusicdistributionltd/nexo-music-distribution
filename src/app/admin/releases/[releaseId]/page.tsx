import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { QcDecisionForm } from "@/components/admin/QcDecisionForm";
import { TrackPlayer } from "@/components/admin/TrackPlayer";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { getReleaseDetail } from "@/lib/releases/queries";
import { createSignedAssetUrl } from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";
import { isQcableStatus } from "@/lib/admin/qc";
import { getProviderConnectionState } from "@/lib/provider";

export const metadata: Metadata = {
  title: "Release review",
  robots: { index: false, follow: false },
};

export default async function AdminReleaseDetailPage({
  params,
}: {
  params: Promise<{ releaseId: string }>;
}) {
  await RequireAdmin();
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
      const audio = assets.find((a) => a.kind === "audio" && a.track_id === t.id)
        ?? assets.find((a) => a.kind === "audio" && !a.track_id);
      const url = audio
        ? await createSignedAssetUrl(audio.storage_bucket, audio.storage_path, 300)
        : null;
      return { track: t, url };
    })
  );

  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("qc_reviews")
    .select("*")
    .eq("release_id", releaseId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title={release.title || "Untitled release"}
        description={`${release.primary_artist_name} · ${release.release_type}`}
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
          <h2 className="text-h4">Metadata</h2>
          <dl className="grid grid-cols-2 gap-2 text-small">
            {[
              ["Genre", release.genre],
              ["Subgenre", release.subgenre],
              ["Language", release.language],
              ["Label", release.label_name],
              ["Copyright", release.copyright_line],
              ["Phonogram", release.phonogram_line],
              ["Explicit", release.explicit ? "Yes" : "No"],
              ["Territories", (release.territories || []).join(", ")],
            ].map(([k, v]) => (
              <div key={String(k)} className="contents">
                <dt className="text-[var(--nexo-text-muted)]">{k}</dt>
                <dd>{v || "—"}</dd>
              </div>
            ))}
          </dl>
          {release.description ? (
            <p className="text-small text-[var(--nexo-text-secondary)]">{release.description}</p>
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
            trackPlayers.map(({ track, url }) => (
              <TrackPlayer
                key={track.id}
                trackNumber={track.track_number}
                title={track.title}
                signedUrl={url}
              />
            ))
          )}
          <h3 className="pt-2 text-label">Contributors</h3>
          {contributors.length === 0 ? (
            <p className="text-caption text-[var(--nexo-text-muted)]">None listed.</p>
          ) : (
            <ul className="space-y-1 text-small">
              {contributors.map((c) => (
                <li key={c.id}>
                  {c.name} · {c.role}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isQcableStatus(release.status) ? <QcDecisionForm releaseId={release.id} /> : null}

      <section className="space-y-2">
        <h2 className="text-h4">QC reviews</h2>
        {(reviews ?? []).length === 0 ? (
          <p className="text-small text-[var(--nexo-text-muted)]">No QC reviews yet.</p>
        ) : (
          <ul className="space-y-2 text-small">
            {(reviews ?? []).map((r: {
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
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-h4">Status history</h2>
        <ul className="space-y-1 text-small">
          {history.map((h) => (
            <li key={h.id}>
              {h.previous_status ?? "—"} → {h.new_status} ·{" "}
              {new Date(h.created_at).toLocaleString()}
              {h.reason ? ` · ${h.reason}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
