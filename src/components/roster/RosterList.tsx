import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RosterArtist } from "@/lib/roster/types";

export function RosterList({
  artists,
  releaseCounts,
}: {
  artists: RosterArtist[];
  releaseCounts: Record<string, number>;
}) {
  if (!artists.length) {
    return (
      <EmptyState
        title="No roster artists yet"
        description="Create an artist to attach releases. This does not convert your Label account."
      />
    );
  }

  return (
    <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
      {artists.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <Link
              href={`/app/artists/${a.id}`}
              className="font-medium text-[var(--nexo-text)] underline-offset-2 hover:underline"
            >
              {a.artist_name || a.stage_name}
            </Link>
            <p className="text-small text-[var(--nexo-text-muted)]">
              {[a.country, (a.genres ?? []).slice(0, 3).join(", ")]
                .filter(Boolean)
                .join(" · ") || "Managed roster artist"}
            </p>
          </div>
          <div className="flex items-center gap-3 text-small">
            <span className="text-[var(--nexo-text-muted)]">
              {releaseCounts[a.id] ?? 0} release
              {(releaseCounts[a.id] ?? 0) === 1 ? "" : "s"}
            </span>
            <Link
              href={`/app/artists/${a.id}`}
              className="rounded-full border border-[var(--nexo-border)] px-3 py-1 hover:bg-[var(--nexo-ghost-hover)]"
            >
              Edit
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
