"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { upsertMappingAction } from "@/app/admin/distribution/actions";

const DSPS = [
  ["spotify", "Spotify"],
  ["apple_music", "Apple Music"],
  ["youtube_music", "YouTube Music"],
  ["amazon_music", "Amazon Music"],
  ["deezer", "Deezer"],
  ["tidal", "TIDAL"],
  ["audiomack", "Audiomack"],
  ["pandora", "Pandora"],
] as const;

export function MappingClient({ artists }: { artists: Array<{ id: string; name: string }> }) {
  const [artistProfileId, setArtistProfileId] = useState("");
  const [dspName, setDspName] = useState("spotify");
  const [externalId, setExternalId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <Select value={artistProfileId} onChange={(e) => setArtistProfileId(e.target.value)}>
        <option value="">Select artist</option>
        {artists.map((artist) => (
          <option key={artist.id} value={artist.id}>{artist.name}</option>
        ))}
      </Select>
      <Select value={dspName} onChange={(e) => setDspName(e.target.value)}>
        {DSPS.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </Select>
      <Input
        placeholder="External artist id"
        value={externalId}
        onChange={(e) => setExternalId(e.target.value)}
      />
      <Button
        size="sm"
        disabled={pending || !artistProfileId.trim() || !dspName.trim()}
        onClick={() =>
          start(async () => {
            const r = await upsertMappingAction({
              artistProfileId: artistProfileId.trim(),
              dspName: dspName.trim(),
              externalArtistId: externalId.trim() || undefined,
            });
            setMsg(r.ok ? "Mapping saved." : r.error);
          })
        }
      >
        Save mapping
      </Button>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}
