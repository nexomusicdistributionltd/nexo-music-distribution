"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { upsertMappingAction } from "@/app/admin/distribution/actions";

export function MappingClient() {
  const [artistProfileId, setArtistProfileId] = useState("");
  const [dspName, setDspName] = useState("spotify");
  const [externalId, setExternalId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <Input
        placeholder="Artist profile id (uuid)"
        value={artistProfileId}
        onChange={(e) => setArtistProfileId(e.target.value)}
      />
      <Input
        placeholder="DSP name (spotify, apple_music, …)"
        value={dspName}
        onChange={(e) => setDspName(e.target.value)}
      />
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
            setMsg(r.ok ? "Mapping saved (source_connected=false)." : r.error);
          })
        }
      >
        Save mapping
      </Button>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}
