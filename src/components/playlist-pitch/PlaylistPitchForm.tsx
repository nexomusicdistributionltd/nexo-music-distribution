"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { createPlaylistPitch, submitPlaylistPitch } from "@/app/(portal)/dashboard/playlist-pitch/actions";

export function PlaylistPitchForm({
  releases,
}: {
  releases: { id: string; title: string | null }[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        const fd = new FormData(e.currentTarget);
        const res = await createPlaylistPitch({
          playlist_name: String(fd.get("playlist_name") || ""),
          playlist_url: String(fd.get("playlist_url") || ""),
          pitch_note: String(fd.get("pitch_note") || ""),
          release_id: String(fd.get("release_id") || "") || undefined,
        });
        setPending(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }}
    >
      <h2 className="text-h4">New pitch</h2>
      {error ? (
        <Alert variant="warning" title="Not saved">
          {error}
        </Alert>
      ) : null}
      <Input name="playlist_name" required placeholder="Playlist name" aria-label="Playlist name" />
      <Input name="playlist_url" placeholder="https://…" aria-label="Playlist URL" />
      {releases.length > 0 ? (
        <select
          name="release_id"
          className="h-10 w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 text-small"
          aria-label="Related release"
          defaultValue=""
        >
          <option value="">Related release (optional)</option>
          {releases.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title || "Untitled"}
            </option>
          ))}
        </select>
      ) : null}
      <Textarea name="pitch_note" rows={4} placeholder="Why this playlist?" aria-label="Pitch note" />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Save draft"}
      </Button>
    </form>
  );
}

export function SubmitPitchButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div>
      <Button
        size="sm"
        disabled={pending}
        aria-busy={pending}
        onClick={async () => {
          if (pending) return;
          setPending(true);
          const res = await submitPlaylistPitch(id);
          setPending(false);
          if (!res.ok) setError(res.error);
          else router.refresh();
        }}
      >
        {pending ? "Submitting…" : "Submit for review"}
      </Button>
      {error ? <p className="mt-1 text-caption text-[var(--nexo-error)]">{error}</p> : null}
    </div>
  );
}
