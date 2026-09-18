import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { PitchReviewControls } from "@/components/admin/PitchReviewControls";

export const metadata: Metadata = {
  title: "Playlist pitches",
  robots: { index: false, follow: false },
};

export default async function AdminPlaylistPitchesPage() {
  await RequireAdminPermission("admin:marketing");
  const supabase = await createClient();
  const { data } = await supabase
    .from("playlist_pitch_requests")
    .select(
      "id, playlist_name, playlist_url, pitch_note, status, created_at, submitted_at, admin_note, owner_user_id"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const items = data ?? [];

  return (
    <div>
      <PageHeader
        title="Playlist pitching"
        description="Review artist and label playlist requests. Status: draft / submitted / reviewing / accepted / rejected."
      />
      {items.length === 0 ? (
        <EmptyState title="No pitches" description="Submitted playlist pitches appear here." />
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li
              key={p.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{p.playlist_name}</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {p.status} · {new Date(p.created_at).toLocaleString()}
                    {p.playlist_url ? ` · ${p.playlist_url}` : ""}
                  </p>
                  {p.pitch_note ? <p className="mt-2 text-small whitespace-pre-wrap">{p.pitch_note}</p> : null}
                </div>
                <PitchReviewControls id={p.id} status={p.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
