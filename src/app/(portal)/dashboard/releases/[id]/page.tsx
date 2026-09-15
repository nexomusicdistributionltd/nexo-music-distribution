import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { ReleaseRowActions } from "@/components/releases/ReleaseRowActions";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { ReleaseWizard } from "@/components/releases/ReleaseWizard";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { RequireRole } from "@/lib/auth/guards";
import { isEditableStatus } from "@/lib/releases/status";
import { getReleaseDetail } from "@/lib/releases/queries";
import type { ReleaseStatus } from "@/lib/releases/types";
import { providerNotConnectedMessage } from "@/lib/provider/errors";
import {
  getLabelProfileIdForUser,
  listRosterArtists,
} from "@/lib/roster/queries";

export const metadata: Metadata = {
  title: "Release",
  robots: { index: false, follow: false },
};

export default async function ReleaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await RequireRole(["artist", "label"]);
  const { id } = await params;
  const sp = await searchParams;
  const edit = sp.edit === "1";

  const detail = await getReleaseDetail(id);
  if (!detail || detail.release.owner_user_id !== ctx.userId) notFound();

  const { release, tracks, contributors, assets, history } = detail;
  const editable = isEditableStatus(release.status);

  const isLabel = ctx.roles.includes("label");
  let rosterArtists: { id: string; artist_name: string; stage_name: string }[] = [];
  if (isLabel && edit && editable) {
    const labelId = await getLabelProfileIdForUser(ctx.userId);
    if (labelId) {
      const roster = await listRosterArtists(labelId);
      rosterArtists = roster.map((a) => ({
        id: a.id,
        artist_name: a.artist_name,
        stage_name: a.stage_name,
      }));
    }
  }

  if (edit && editable) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-h2">Edit release</h1>
          <Link href={`/dashboard/releases/${id}`} className="text-small underline">
            View details
          </Link>
        </div>
        <ReleaseWizard
          mode="edit"
          initial={release}
          tracks={tracks}
          contributors={contributors}
          assets={assets}
          accountRole={isLabel ? "label" : "artist"}
          rosterArtists={rosterArtists}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h2">{release.title || "Untitled draft"}</h1>
            <ReleaseStatusBadge status={release.status as ReleaseStatus} />
          </div>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            {release.primary_artist_name} · {release.release_type}
            {release.release_date ? ` · ${release.release_date}` : ""}
          </p>
        </div>
        <ReleaseRowActions id={release.id} status={release.status as ReleaseStatus} />
      </div>

      <ProviderBanner connected={release.provider_connected} />

      {!release.provider_connected ? (
        <Alert title="Delivery unavailable">{providerNotConnectedMessage()}</Alert>
      ) : null}

      {release.changes_requested_reason ? (
        <Alert variant="warning" title="Changes requested">
          {release.changes_requested_reason}
        </Alert>
      ) : null}
      {release.rejection_reason ? (
        <Alert variant="error" title="Rejected">
          {release.rejection_reason}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-small">
            <p>Genre: {release.genre || "—"}</p>
            <p>Label: {release.label_name || "—"}</p>
            <p>UPC: {release.upc || "Not provided"}</p>
            <p>Copyright: {release.copyright_line || "—"}</p>
            <p>Phonogram: {release.phonogram_line || "—"}</p>
            <p>Territories: {(release.territories ?? []).join(", ") || "—"}</p>
            <p>Explicit: {release.explicit ? "Yes" : "No"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tracks ({tracks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-small">
              {tracks.map((t) => (
                <li key={t.id}>
                  {t.track_number}. {t.title || "Untitled"}
                  {t.isrc ? ` · ${t.isrc}` : " · no ISRC"}
                </li>
              ))}
              {tracks.length === 0 ? <li className="text-[var(--nexo-text-muted)]">No tracks</li> : null}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-small">
              {contributors.map((c) => (
                <li key={c.id}>
                  {c.name} · {c.role.replace(/_/g, " ")}
                </li>
              ))}
              {contributors.length === 0 ? (
                <li className="text-[var(--nexo-text-muted)]">None</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-small">
              {assets.map((a) => (
                <li key={a.id}>
                  {a.kind}: {a.filename}{" "}
                  <span className="text-[var(--nexo-text-muted)]">
                    ({a.storage_bucket}/{a.storage_path.split("/").slice(-1)[0]})
                  </span>
                </li>
              ))}
              {assets.length === 0 ? <li className="text-[var(--nexo-text-muted)]">None</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status history</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-small">
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
            {history.length === 0 ? (
              <li className="text-[var(--nexo-text-muted)]">No transitions yet</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
