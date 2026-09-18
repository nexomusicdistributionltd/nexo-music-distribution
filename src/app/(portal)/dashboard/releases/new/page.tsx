import type { Metadata } from "next";
import { ReleaseWizard } from "@/components/releases/ReleaseWizard";
import { RequireRole } from "@/lib/auth/guards";
import {
  getLabelProfileForUser,
  listRosterArtists,
} from "@/lib/roster/queries";

export const metadata: Metadata = {
  title: "New release",
  robots: { index: false, follow: false },
};

export default async function NewReleasePage({
  searchParams,
}: {
  searchParams: Promise<{ artist?: string }>;
}) {
  const ctx = await RequireRole(["artist", "label"]);
  const sp = await searchParams;
  const isLabel = ctx.roles.includes("label");
  let rosterArtists: { id: string; artist_name: string; stage_name: string }[] = [];
  let defaultLabelName = "";
  if (isLabel) {
    const label = await getLabelProfileForUser(ctx.userId);
    defaultLabelName = label?.label_name?.trim() || "";
    if (label?.id) {
      const roster = await listRosterArtists(label.id);
      rosterArtists = roster.map((a) => ({
        id: a.id,
        artist_name: a.artist_name,
        stage_name: a.stage_name,
      }));
    }
  }

  const requestedArtistId = (sp.artist ?? "").trim();
  const initialArtistProfileId =
    isLabel && rosterArtists.some((artist) => artist.id === requestedArtistId)
      ? requestedArtistId
      : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2">Create release</h1>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          Multi-step wizard — drafts save as you continue. No ISRC/UPC is auto-fabricated.
        </p>
      </div>
      <ReleaseWizard
        mode="create"
        accountRole={isLabel ? "label" : "artist"}
        rosterArtists={rosterArtists}
        initialArtistProfileId={initialArtistProfileId}
        defaultLabelName={defaultLabelName}
      />
    </div>
  );
}
