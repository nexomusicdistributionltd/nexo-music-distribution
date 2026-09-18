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
  const [migrationId, setMigrationId] = useState<string | null>(null);
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
              if (r.ok) {
                const id =
                  r.data && typeof r.data === "object" && "id" in r.data
                    ? String((r.data as { id: unknown }).id)
                    : null;
                setMigrationId(id);
                setMsg(
                  id
                    ? "Migration created. Live TooLost catalog discovery is ready."
                    : "Migration created."
                );
              } else {
                setMsg(r.error);
              }
            })
          }
        >
          Create migration
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || !migrationId}
          onClick={() =>
            start(async () => {
              const r = await discoverCatalogAction("spotify", migrationId ?? undefined);
              setMsg(
                r.available
                  ? r.note ??
                    `Found ${r.items.length} live TooLost release(s) with Spotify delivery metadata; ${r.importedIntoMigration} new item(s) added to this migration.`
                  : r.reason
              );
            })
          }
        >
          Discover Spotify via TooLost
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || !migrationId}
          onClick={() =>
            start(async () => {
              const r = await discoverCatalogAction("apple_music", migrationId ?? undefined);
              setMsg(
                r.available
                  ? r.note ??
                    `Found ${r.items.length} live TooLost release(s) with Apple Music delivery metadata; ${r.importedIntoMigration} new item(s) added to this migration.`
                  : r.reason
              );
            })
          }
        >
          Discover Apple Music via TooLost
        </Button>
      </div>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Create the migration first, then discovery reads Nexo&apos;s live TooLost catalog and
        stores only real provider rows in the migration review queue. Artist/label Move In remains
        ownership-scoped and can use JSON/CSV/manual import when no dedicated external catalog API
        is connected.
      </p>
    </div>
  );
}
