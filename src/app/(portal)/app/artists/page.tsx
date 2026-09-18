import type { Metadata } from "next";
import Link from "next/link";
import { CoverArt } from "@/components/workspace/CoverArt";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { RequireRole } from "@/lib/auth/guards";
import {
  countReleasesForArtists,
  getLabelProfileIdForUser,
  listRosterArtists,
} from "@/lib/roster/queries";

export const metadata: Metadata = {
  title: "Roster",
  robots: { index: false, follow: false },
};

export default async function LabelArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await RequireRole("label");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const labelId = await getLabelProfileIdForUser(ctx.userId);
  const artists = labelId ? await listRosterArtists(labelId) : [];
  const filtered = q
    ? artists.filter((a) =>
        `${a.artist_name} ${a.stage_name} ${a.country ?? ""} ${(a.genres ?? []).join(" ")}`
          .toLowerCase()
          .includes(q)
      )
    : artists;
  const releaseCounts = await countReleasesForArtists(filtered.map((a) => a.id));

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Label"
        title="Artist Roster"
        description="Manage your label roster, artist identities, DSP profiles and release activity from one place. Creating an artist does not create a separate login."
        actions={
          <Link
            href="/app/artists/new"
            className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-[length:0.875rem] font-medium [color:var(--nexo-primary-fg)] hover:bg-[var(--nexo-primary-hover)]"
          >
            Create artist
          </Link>
        }
      />
      <form method="get" className="max-w-sm">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search roster" aria-label="Search roster" />
      </form>
      {filtered.length === 0 ? (
        <EmptyState
          title={q ? "No matching artists" : "No roster artists yet"}
          description={
            q
              ? "Try a different search."
              : "Create an artist to attach releases. This does not convert your Label account."
          }
          action={
            q ? undefined : (
              <Link
                href="/app/artists/new"
                className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
              >
                Create artist
              </Link>
            )
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Artist</TH>
              <TH>Location</TH>
              <TH>Releases</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((a) => (
              <TR key={a.id}>
                <TD>
                  <Link href={`/app/artists/${a.id}`} className="flex items-center gap-3 font-medium hover:underline">
                    <CoverArt src={a.avatar_url} title={a.artist_name || a.stage_name} size={36} />
                    <span>
                      {a.artist_name || a.stage_name}
                      <span className="block text-caption font-normal text-[var(--nexo-text-muted)]">
                        {(a.genres ?? []).slice(0, 3).join(", ") || "Managed roster artist"}
                      </span>
                    </span>
                  </Link>
                </TD>
                <TD>{a.country || "—"}</TD>
                <TD>{releaseCounts[a.id] ?? 0}</TD>
                <TD className="text-right">
                  <Link
                    href={`/app/artists/${a.id}`}
                    className="text-caption underline-offset-4 hover:underline"
                  >
                    Open
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
