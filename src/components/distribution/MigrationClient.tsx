"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createMigrationAction,
  discoverCatalogAction,
} from "@/app/admin/distribution/actions";

export function MigrationClient() {
  const [ownerUserId, setOwnerUserId] = useState("");
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <Input
        placeholder="Owner user id (uuid)"
        value={ownerUserId}
        onChange={(e) => setOwnerUserId(e.target.value)}
      />
      <Input
        placeholder="Migration title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending || !ownerUserId.trim()}
          onClick={() =>
            start(async () => {
              const r = await createMigrationAction({
                ownerUserId: ownerUserId.trim(),
                title: title.trim() || undefined,
              });
              setMsg(
                r.ok
                  ? "Migration created (status unavailable until external catalog connected)."
                  : r.error
              );
            })
          }
        >
          Create migration
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await discoverCatalogAction("spotify");
              setMsg(
                r.available
                  ? `Discovered ${r.items.length} items`
                  : r.reason
              );
            })
          }
        >
          Discover Spotify
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await discoverCatalogAction("apple_music");
              setMsg(
                r.available
                  ? `Discovered ${r.items.length} items`
                  : r.reason
              );
            })
          }
        >
          Discover Apple Music
        </Button>
      </div>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}
