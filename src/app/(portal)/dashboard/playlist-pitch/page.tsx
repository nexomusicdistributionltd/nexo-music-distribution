import type { Metadata } from "next";
import { RequireRole } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { PlaylistPitchForm, SubmitPitchButton } from "@/components/playlist-pitch/PlaylistPitchForm";

export const metadata: Metadata = {
  title: "Playlist pitching",
  robots: { index: false, follow: false },
};

export default async function PlaylistPitchPage() {
  const ctx = await RequireRole(["artist", "label"]);
  const supabase = await createClient();
  const [{ data: pitches }, { data: releases }] = await Promise.all([
    supabase
      .from("playlist_pitch_requests")
      .select("id, playlist_name, playlist_url, pitch_note, status, created_at, submitted_at, admin_note")
      .eq("owner_user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("releases")
      .select("id, title")
      .eq("owner_user_id", ctx.userId)
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);

  return (
    <div className="space-y-8">
      <PageIntro
        title="Playlist pitching"
        description="Request playlist consideration for a release. Staff review submitted pitches — this does not place you on a DSP playlist."
      />
      <PlaylistPitchForm releases={releases ?? []} />
      {(pitches ?? []).length === 0 ? (
        <EmptyState title="No pitches yet" description="Save a draft, then submit it for review." />
      ) : (
        <ul className="space-y-3">
          {(pitches ?? []).map((p) => (
            <li
              key={p.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{p.playlist_name}</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {p.status}
                    {p.playlist_url ? ` · ${p.playlist_url}` : ""}
                  </p>
                  {p.pitch_note ? <p className="mt-2 text-small">{p.pitch_note}</p> : null}
                  {p.admin_note ? (
                    <p className="mt-2 text-small text-[var(--nexo-text-muted)]">Staff: {p.admin_note}</p>
                  ) : null}
                </div>
                {p.status === "draft" || p.status === "rejected" ? <SubmitPitchButton id={p.id} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
