import type { Metadata } from "next";
import { ReleaseWizard } from "@/components/releases/ReleaseWizard";
import { distributionMetadataLookups } from "@/lib/provider/distribution-reference";
import { RequireRole } from "@/lib/auth/guards";
import {
  getLabelProfileIdForUser,
  listRosterArtists,
} from "@/lib/roster/queries";

export const metadata: Metadata = {
  title: "New release",
  robots: { index: false, follow: false },
};

export default async function NewReleasePage() {
  const ctx = await RequireRole(["artist", "label"]);
  const isLabel = ctx.roles.includes("label");
  const lookups = await distributionMetadataLookups().catch(() => ({ genres: [], languages: [], platforms: [] }));
  let rosterArtists: { id: string; artist_name: string; stage_name: string }[] = [];
  if (isLabel) {
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
        genreOptions={lookups.genres}
        languageOptions={lookups.languages}
        platformOptions={lookups.platforms}
      />
    </div>
  );
}
