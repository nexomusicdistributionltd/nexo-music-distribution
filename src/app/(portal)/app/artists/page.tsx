import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { RosterList } from "@/components/roster/RosterList";
import { RequireRole } from "@/lib/auth/guards";
import {
  countReleasesForArtist,
  getLabelProfileIdForUser,
  listRosterArtists,
} from "@/lib/roster/queries";

export const metadata: Metadata = {
  title: "Roster",
  robots: { index: false, follow: false },
};

export default async function LabelArtistsPage() {
  const ctx = await RequireRole("label");
  const labelId = await getLabelProfileIdForUser(ctx.userId);
  const artists = labelId ? await listRosterArtists(labelId) : [];
  const releaseCounts: Record<string, number> = {};
  await Promise.all(
    artists.map(async (a) => {
      releaseCounts[a.id] = await countReleasesForArtist(a.id);
    })
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2">Artists</h1>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            Manage your label roster. Creating artists does not change your Label account type or
            roles.
          </p>
        </div>
        <Link
          href="/app/artists/new"
          className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-[length:0.875rem] font-medium [color:var(--nexo-primary-fg)] hover:bg-[var(--nexo-primary-hover)]"
        >
          Create artist
        </Link>
      </div>
      <Alert>
        Label roster tools live here. The public For Artists page remains at <strong>/artists</strong>.
      </Alert>
      <RosterList artists={artists} releaseCounts={releaseCounts} />
    </div>
  );
}
