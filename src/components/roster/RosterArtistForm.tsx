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
import { DspIcon } from "@/components/fanlink/DspIcon";
import { DSP_PROFILE_SPECS, type DspProfileKey } from "@/lib/dsp/profile-links";

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
  const [dspLinks, setDspLinks] = React.useState<Record<string, { url: string; enabled: boolean }>>(() => Object.fromEntries(DSP_PROFILE_SPECS.map((d) => [d.key, { url: "", enabled: false }])));
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
        ? await createRosterArtist(payload, DSP_PROFILE_SPECS.map((d) => ({ dspKey: d.key as DspProfileKey, url: dspLinks[d.key].url, enabled: dspLinks[d.key].enabled })))
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
      {mode === "create" ? (
        <section className="space-y-3 rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
          <div><h2 className="text-h4">DSP artist profiles</h2><p className="mt-1 text-caption text-[var(--nexo-text-muted)]">Turn on stores where this artist already has a profile and paste the matching artist URL. Leave a store off for a new artist with no existing profile there.</p></div>
          <div className="grid gap-3">{DSP_PROFILE_SPECS.map((dsp) => { const row = dspLinks[dsp.key]; return (
            <div key={dsp.key} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-small font-medium"><DspIcon name={dsp.key === "applemusic" ? "apple_music" : dsp.key} className="h-5 w-5" />{dsp.title}</span><button type="button" role="switch" aria-checked={row.enabled} onClick={() => setDspLinks((prev) => ({ ...prev, [dsp.key]: { ...prev[dsp.key], enabled: !prev[dsp.key].enabled } }))} className={`relative h-6 w-11 rounded-full transition-colors ${row.enabled ? "bg-[var(--nexo-text)]" : "bg-[var(--nexo-elevated)]"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${row.enabled ? "left-6" : "left-1"}`} /></button></div>
              {row.enabled ? <Input className="mt-3" type="url" required value={row.url} onChange={(e) => setDspLinks((prev) => ({ ...prev, [dsp.key]: { ...prev[dsp.key], url: e.target.value } }))} placeholder={`Paste ${dsp.title} artist profile URL`} /> : null}
            </div>); })}</div>
        </section>
      ) : null}
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
