"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { reviewPlaylistPitchAction } from "@/app/admin/playlist-pitches/actions";
import type { PlaylistPitchStatus } from "@/lib/playlist-pitch/status";

const NEXT: Record<string, PlaylistPitchStatus[]> = {
  submitted: ["reviewing", "accepted", "rejected"],
  reviewing: ["accepted", "rejected", "submitted"],
  draft: ["reviewing", "rejected"],
  rejected: ["reviewing"],
};

export function PitchReviewControls({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const options = NEXT[status] ?? [];
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Admin note (optional)" />
      <div className="flex flex-wrap gap-2">
        {options.map((next) => (
          <Button
            key={next}
            size="sm"
            variant={next === "rejected" ? "outline" : "secondary"}
            disabled={!!pending}
            onClick={async () => {
              if (pending) return;
              setPending(next);
              const res = await reviewPlaylistPitchAction({ id, status: next, adminNote: note });
              setPending(null);
              if (!res.ok) setError(res.error);
              else router.refresh();
            }}
          >
            {pending === next ? "…" : next}
          </Button>
        ))}
      </div>
      {error ? <p className="text-caption text-[var(--nexo-error)]">{error}</p> : null}
    </div>
  );
}
