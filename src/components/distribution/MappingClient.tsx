"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { upsertMappingAction } from "@/app/admin/distribution/actions";

type ArtistOption = {
  id: string;
  name: string;
};

const DSPS = [
  ["spotify", "Spotify"],
  ["apple_music", "Apple Music"],
  ["youtube_music", "YouTube Music"],
  ["amazon_music", "Amazon Music"],
  ["audiomack", "Audiomack"],
  ["deezer", "Deezer"],
  ["tidal", "TIDAL"],
  ["soundcloud", "SoundCloud"],
  ["tiktok", "TikTok"],
] as const;

export function MappingClient({ artists }: { artists: ArtistOption[] }) {
  const [artistProfileId, setArtistProfileId] = useState(artists[0]?.id ?? "");
  const [dspName, setDspName] = useState("spotify");
  const [externalId, setExternalId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [verified, setVerified] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <div>
        <h2 className="text-h4">Add or update artist mapping</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Map a Nexo artist profile to the artist identifier shown by the Distribution Engine or DSP.
          This never creates a fake connection.
        </p>
      </div>

      {artists.length === 0 ? (
        <p className="text-small text-[var(--nexo-text-muted)]">
          No artist profiles are available yet.
        </p>
      ) : (
        <>
          <Select value={artistProfileId} onChange={(e) => setArtistProfileId(e.target.value)}>
            {artists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.name}
              </option>
            ))}
          </Select>
          <Select value={dspName} onChange={(e) => setDspName(e.target.value)}>
            {DSPS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Input
            placeholder="External artist ID"
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
          />
          <Input
            placeholder="Artist profile URL (optional)"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
          />
          <label className="flex items-center gap-2 text-small">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />
            Mapping manually verified by staff
          </label>
          <Button
            size="sm"
            disabled={pending || !artistProfileId || !dspName.trim() || !externalId.trim()}
            onClick={() =>
              start(async () => {
                const r = await upsertMappingAction({
                  artistProfileId,
                  dspName: dspName.trim(),
                  externalArtistId: externalId.trim(),
                  externalArtistUrl: externalUrl.trim() || undefined,
                  verified,
                });
                setMsg(r.ok ? "Artist mapping saved." : r.error);
              })
            }
          >
            {pending ? "Saving…" : "Save mapping"}
          </Button>
          {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
        </>
      )}
    </div>
  );
}
