import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReleaseDetailView } from "@/components/releases/ReleaseDetailView";
import { ReleaseWizard } from "@/components/releases/ReleaseWizard";
import { RequireRole } from "@/lib/auth/guards";
import { createSignedAssetUrl } from "@/lib/admin/queries";
import { isEditableStatus } from "@/lib/releases/status";
import { getReleaseDetail } from "@/lib/releases/queries";
import {
  getLabelProfileIdForUser,
  listRosterArtists,
} from "@/lib/roster/queries";
import { DdexOwnerStatus } from "@/components/ddex/DdexOwnerStatus";
import { listOwnerDdexStatus } from "@/lib/ddex/persistence";
import { DspTargetingPanel } from "@/components/roster/DspTargetingPanel";
import { createClient } from "@/lib/supabase/server";

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
          <h2 className="text-h3">Edit release</h2>
          <Link href={`/dashboard/releases/${id}`} className="text-small underline-offset-4 hover:underline">
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

  const artwork = assets.find((a) => a.kind === "artwork");
  const artworkUrl = artwork
    ? await createSignedAssetUrl(artwork.storage_bucket, artwork.storage_path, 300)
    : null;

  let ownerStatus: Awaited<ReturnType<typeof listOwnerDdexStatus>> = [];
  try {
    ownerStatus = await listOwnerDdexStatus(id);
  } catch {
    ownerStatus = [];
  }

  const supabase = await createClient();
  const { data: dspTargets } = await supabase
    .from("release_dsp_profile_targets")
    .select("dsp_key, url, enabled")
    .eq("release_id", id);

  return (
    <ReleaseDetailView
      variant="portal"
      release={release}
      tracks={tracks}
      contributors={contributors}
      assets={assets}
      history={history}
      artworkUrl={artworkUrl}
      ddexPanel={<DdexOwnerStatus rows={ownerStatus} />}
      extra={
        <DspTargetingPanel
          targets={(dspTargets ?? []).map((t) => ({
            dsp_key: t.dsp_key,
            url: t.url,
            enabled: t.enabled,
          }))}
        />
      }
    />
  );
}
