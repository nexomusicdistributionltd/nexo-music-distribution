"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  createRosterArtist,
  updateRosterArtist,
} from "@/app/(portal)/app/artists/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { RosterArtist } from "@/lib/roster/types";

export function RosterArtistForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: RosterArtist | null;
}) {
  const router = useRouter();
  const [stageName, setStageName] = React.useState(initial?.stage_name ?? "");
  const [country, setCountry] = React.useState(initial?.country ?? "");
  const [genre, setGenre] = React.useState((initial?.genres ?? []).join(", "));
  const [bio, setBio] = React.useState(initial?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(initial?.avatar_url ?? "");
  const [website, setWebsite] = React.useState(initial?.website ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      stage_name: stageName,
      country: country || null,
      genres: genre
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
      bio: bio || null,
      avatar_url: avatarUrl || null,
      website: website || null,
    };
    const res =
      mode === "create"
        ? await createRosterArtist(payload)
        : await updateRosterArtist(initial!.id, payload);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(mode === "create" ? "/app/artists" : `/app/artists/${res.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
      {error ? (
        <Alert variant="warning" title="Could not save">
          {error}
        </Alert>
      ) : null}
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">
          Stage / display name *
        </span>
        <Input
          value={stageName}
          onChange={(e) => setStageName(e.target.value)}
          required
          placeholder="Artist name"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">Country</span>
        <Input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="e.g. GB"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">
          Genre(s) (comma-separated)
        </span>
        <Input
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder="Pop, Electronic"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">Bio (optional)</span>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">
          Image URL (optional)
        </span>
        <Input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://..."
        />
      </label>
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">Website</span>
        <Input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://..."
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {mode === "create" ? "Create artist" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/app/artists")}
        >
          Cancel
        </Button>
      </div>
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Creates a managed artist profile on your roster only. Your Label account
        type and roles are unchanged — no login is created for the artist.
      </p>
    </form>
  );
}
