import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RosterArtistForm } from "@/components/roster/RosterArtistForm";
import { DspProfileLinksEditor } from "@/components/roster/DspProfileLinksEditor";
import { RequireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  getLabelProfileIdForUser,
  getRosterArtist,
  listArtistDspLinks,
} from "@/lib/roster/queries";

export const metadata: Metadata = {
  title: "Edit artist",
  robots: { index: false, follow: false },
};

export default async function EditRosterArtistPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const ctx = await RequireRole("label");
  const { artistId } = await params;
  const labelId = await getLabelProfileIdForUser(ctx.userId);
  if (!labelId) notFound();

  const supabase = await createClient();
  const { data: link } = await supabase
    .from("label_roster_artists")
    .select("id")
    .eq("label_profile_id", labelId)
    .eq("artist_profile_id", artistId)
    .maybeSingle();
  if (!link) notFound();

  const artist = await getRosterArtist(artistId);
  if (!artist) notFound();
  const dspLinks = await listArtistDspLinks(artistId);

  const { data: releases } = await supabase
    .from("releases")
    .select("id, title, status, release_type")
    .eq("artist_profile_id", artistId)
    .eq("owner_user_id", ctx.userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h2">{artist.artist_name || artist.stage_name}</h1>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          Managed roster artist · no login user linked
        </p>
      </div>
      <RosterArtistForm mode="edit" initial={artist} />
      <DspProfileLinksEditor artistProfileId={artist.id} initial={dspLinks} />
      <section className="space-y-3">
        <h2 className="text-h4">Releases</h2>
        {(releases ?? []).length === 0 ? (
          <p className="text-small text-[var(--nexo-text-muted)]">
            No releases linked yet.{" "}
            <Link href="/dashboard/releases/new" className="underline">
              Create a release
            </Link>{" "}
            and select this artist.
          </p>
        ) : (
          <ul className="space-y-2">
            {(releases ?? []).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/releases/${r.id}`}
                  className="text-small underline-offset-2 hover:underline"
                >
                  {r.title || "Untitled"} · {r.release_type} · {r.status}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
