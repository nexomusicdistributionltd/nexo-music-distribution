import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { getEffectiveAdminPermissionsForContext } from "@/lib/admin/staff-access";
import { QcDecisionForm } from "@/components/admin/QcDecisionForm";
import { AdminReleaseMetadataForm } from "@/components/admin/AdminReleaseMetadataForm";
import { PostApprovalReviewForm } from "@/components/admin/PostApprovalReviewForm";
import { TrackPlayer } from "@/components/admin/TrackPlayer";
import { ReleaseDetailView } from "@/components/releases/ReleaseDetailView";
import { getReleaseDetail } from "@/lib/releases/queries";
import { createSignedAssetUrl } from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";
import { isQcableStatus } from "@/lib/admin/qc";
import { evaluateReleaseReadiness } from "@/lib/ddex/readiness";
import { DdexReadinessPanel } from "@/components/ddex/DdexReadinessPanel";
import { DspTargetingPanel } from "@/components/roster/DspTargetingPanel";
import { RetryJobButton } from "@/components/distribution/DistributionActionForms";
import { Alert } from "@/components/ui/Alert";
import { DeliveryFailurePanel } from "@/components/distribution/DeliveryFailurePanel";
import { diagnoseDeliveryFailure } from "@/lib/distribution/delivery-diagnostics";

export const metadata: Metadata = {
  title: "Release review",
  robots: { index: false, follow: false },
};

export default async function AdminReleaseDetailPage({
  params,
}: {
  params: Promise<{ releaseId: string }>;
}) {
  const adminContext = await RequireAdminPermission("admin:releases");
  const adminPermissions = await getEffectiveAdminPermissionsForContext(adminContext);
  const canOperateDistribution = adminPermissions.has("admin:distribution");
  const { releaseId } = await params;
  const detail = await getReleaseDetail(releaseId);
  if (!detail) notFound();

  const { release, tracks, contributors, assets, history } = detail;
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
  const { data: dspTargets } = await supabase
    .from("release_dsp_profile_targets")
    .select("dsp_key, url, enabled")
    .eq("release_id", releaseId);
  const { data: reviews } = await supabase
    .from("qc_reviews")
    .select("*")
    .eq("release_id", releaseId)
    .order("created_at", { ascending: false });

  const { data: latestDistributionJob } = await supabase
    .from("distribution_jobs")
    .select("id, status, last_error, provider_release_id, updated_at")
    .eq("release_id", releaseId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: deals } = await supabase
    .from("release_deals")
    .select("territories, use_types, commercial_model_types, validity_start, validity_end")
    .eq("release_id", releaseId);

  const adminMetadataEditable = [
    "draft",
    "submitted",
    "in_qc",
    "changes_requested",
    "approved",
    "rejected",
    "failed",
  ].includes(release.status);

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

  return (
    <ReleaseDetailView
      variant="admin"
      release={release}
      tracks={tracks}
      contributors={contributors}
      assets={assets}
      history={history}
      artworkUrl={artworkUrl}
      actions={
        <Link
          href={`/admin/ddex/${release.id}`}
          className="inline-flex h-8 items-center rounded-[var(--nexo-radius)] border border-[var(--nexo-outline-border)] px-3 text-caption font-medium"
        >
          DDEX ops
        </Link>
      }
      qcPanel={
        isQcableStatus(release.status) ? (
          <QcDecisionForm releaseId={release.id} />
        ) : canOperateDistribution &&
          ["approved", "scheduled", "failed"].includes(release.status) ? (
          <PostApprovalReviewForm releaseId={release.id} />
        ) : release.status === "changes_requested" ? (
          <section className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
            <h2 className="text-h4">Admin release control</h2>
            <Alert variant="warning" title="Already declined — waiting for correction">
              This release is already returned to the artist or label. They can edit the release now
              and submit it back to QC when the correction is complete.
              {release.changes_requested_reason
                ? ` Current reason: ${release.changes_requested_reason}`
                : ""}
            </Alert>
          </section>
        ) : null
      }
      ddexPanel={
        <div className="space-y-4">
          <DdexReadinessPanel report={readiness} />
          <Link className="text-small underline-offset-4 hover:underline" href={`/admin/ddex/${release.id}`}>
            Generate / validate / download ERN 4.3.2
          </Link>
        </div>
      }
      extra={
        <div className="space-y-8">
          {adminMetadataEditable ? <AdminReleaseMetadataForm release={release} /> : null}
          {canOperateDistribution &&
          release.status === "failed" &&
          latestDistributionJob?.status === "failed" ? (
            <section className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
              <h2 className="text-h4">Delivery needs attention</h2>
              <Alert variant="warning" title="QC approval is already recorded">
                The release passed Nexo QC, but its delivery attempt failed. Fix any Nexo/provider-format
                issue shown below, then retry delivery. Do not return the release to the artist unless
                the artist actually needs to change metadata or assets.
              </Alert>
              {latestDistributionJob.last_error ? (
                <DeliveryFailurePanel
                  diagnosis={diagnoseDeliveryFailure(latestDistributionJob.last_error)}
                />
              ) : null}
              <RetryJobButton jobId={latestDistributionJob.id} />
            </section>
          ) : null}
          <section className="space-y-3">
            <h2 className="text-h4">Listen</h2>
            {trackPlayers.length === 0 ? (
              <p className="text-small text-[var(--nexo-text-muted)]">No audio assets.</p>
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
          </section>
          <DspTargetingPanel
            targets={(dspTargets ?? []).map((t) => ({
              dsp_key: t.dsp_key,
              url: t.url,
              enabled: t.enabled,
            }))}
          />
          <section className="space-y-2">
            <h2 className="text-h4">QC reviews</h2>
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
                        <p className="mt-1 text-[var(--nexo-text-muted)]">Internal: {r.internal_note}</p>
                      ) : null}
                    </li>
                  )
                )}
              </ul>
            )}
          </section>
        </div>
      }
    />
  );
}
