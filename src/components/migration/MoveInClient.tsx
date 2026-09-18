"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import {
  createOwnMigrationAction,
  importOwnMigrationItemsAction,
  setMigrationStepAction,
  moveInMigrationAction,
  tryExternalDiscoverAction,
} from "@/app/(portal)/dashboard/catalog/move-in/actions";
import {
  parseCatalogCsv,
  parseCatalogJson,
  WORKFLOW_STEPS,
  type ArtistProvidedCatalogItem,
} from "@/lib/migration/move-in";

type MigrationRow = {
  id: string;
  title: string | null;
  status: string;
  workflow_step: string;
  previous_distributor: string | null;
  import_method: string;
  last_job_status: string | null;
  last_job_message: string | null;
  last_job_at: string | null;
  item_count: number;
  conflict_count: number;
  imported_count: number;
};

type ItemRow = {
  id: string;
  external_title: string | null;
  external_artist_name: string | null;
  external_upc: string | null;
  external_isrcs: string[] | null;
  status: string;
  selected: boolean;
  metadata_gaps: string[] | null;
  conflict_reason: string | null;
  draft_release_id: string | null;
};

export function MoveInClient({
  initialMigration,
  initialItems,
}: {
  initialMigration: MigrationRow | null;
  initialItems: ItemRow[];
}) {
  const [migration, setMigration] = useState(initialMigration);
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const [previousDistributor, setPreviousDistributor] = useState("");
  const [importText, setImportText] = useState("");
  const [importFormat, setImportFormat] = useState<"json" | "csv" | "manual">("json");
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualUpc, setManualUpc] = useState("");
  const [manualIsrc, setManualIsrc] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const step = migration?.workflow_step ?? "search";
  const stepIndex = WORKFLOW_STEPS.indexOf(step as (typeof WORKFLOW_STEPS)[number]);

  const selectedIds = useMemo(
    () => items.filter((i) => i.selected).map((i) => i.id),
    [items]
  );

  function applyResult(r: {
    ok: boolean;
    error?: string;
    data?: unknown;
  }) {
    if (!r.ok) {
      setErr(r.error ?? "Action failed");
      setMsg(null);
      return;
    }
    setErr(null);
    const data = (r.data ?? {}) as {
      migration?: MigrationRow;
      items?: ItemRow[];
      reason?: string;
    };
    if (data.migration) setMigration(data.migration);
    if (data.items) setItems(data.items);
    if (data.reason) setMsg(data.reason);
    else setMsg(data.migration?.last_job_message ?? "Updated.");
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-caption">
        {WORKFLOW_STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-full border px-3 py-1 ${
              i <= stepIndex
                ? "border-[var(--nexo-border-strong)] bg-[var(--nexo-elevated)] text-[var(--nexo-text)]"
                : "border-[var(--nexo-border)] text-[var(--nexo-text-muted)]"
            }`}
          >
            {i + 1}. {s.replace("_", " ")}
          </li>
        ))}
      </ol>

      {migration?.last_job_status ? (
        <Alert
          variant="default"
          title={`Job: ${migration.last_job_status}`}
        >
          {migration.last_job_message || "No message."}
          {migration.last_job_at
            ? ` · ${new Date(migration.last_job_at).toLocaleString()}`
            : ""}
        </Alert>
      ) : null}

      {!migration ? (
        <div className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
          <h2 className="text-h4">Start Move In</h2>
          <p className="text-small text-[var(--nexo-text-muted)]">
            Import your catalog from a previous distributor using JSON, CSV, or
            manual metadata. External Spotify/Apple search is only available when
            API credentials are configured — we never invent catalog results.
          </p>
          <Input
            placeholder="Migration title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            placeholder="Previous distributor (required for records)"
            value={previousDistributor}
            onChange={(e) => setPreviousDistributor(e.target.value)}
          />
          <Button
            disabled={pending || !previousDistributor.trim()}
            onClick={() =>
              start(async () => {
                const r = await createOwnMigrationAction({
                  title: title.trim() || undefined,
                  previousDistributor: previousDistributor.trim(),
                  importMethod: "manual",
                });
                applyResult(r);
              })
            }
          >
            Create Move In draft
          </Button>
        </div>
      ) : null}

      {migration && step === "search" ? (
        <div className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
          <h2 className="text-h4">Search / Import</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || items.length === 0}
              onClick={() => setItems((prev) => prev.map((item) => ({ ...item, selected: true })))}
            >
              Select all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || items.length === 0}
              onClick={() => setItems((prev) => prev.map((item) => ({ ...item, selected: false })))}
            >
              Clear selection
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await tryExternalDiscoverAction("spotify");
                  applyResult({
                    ok: true,
                    data: {
                      reason: r.available
                        ? `Discovered ${r.items.length} items`
                        : r.reason,
                    },
                  });
                })
              }
            >
              Try Spotify search
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await tryExternalDiscoverAction("apple_music");
                  applyResult({
                    ok: true,
                    data: {
                      reason: r.available
                        ? `Discovered ${r.items.length} items`
                        : r.reason,
                    },
                  });
                })
              }
            >
              Try Apple Music search
            </Button>
          </div>

          <div className="flex gap-2 text-small">
            {(["json", "csv", "manual"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`rounded-full border px-3 py-1 ${
                  importFormat === f
                    ? "border-[var(--nexo-border-strong)] bg-[var(--nexo-elevated)]"
                    : "border-[var(--nexo-border)]"
                }`}
                onClick={() => setImportFormat(f)}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {importFormat === "manual" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Title"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
              />
              <Input
                placeholder="Artist name"
                value={manualArtist}
                onChange={(e) => setManualArtist(e.target.value)}
              />
              <Input
                placeholder="UPC (optional — never invented)"
                value={manualUpc}
                onChange={(e) => setManualUpc(e.target.value)}
              />
              <Input
                placeholder="ISRC (optional — never invented)"
                value={manualIsrc}
                onChange={(e) => setManualIsrc(e.target.value)}
              />
            </div>
          ) : (
            <Textarea
              rows={8}
              placeholder={
                importFormat === "json"
                  ? '[{"title":"Album","artist_name":"Artist","upc":"…","tracks":[{"track_number":1,"title":"Track 1","isrc":"…"}]}]'
                  : "title,artist_name,upc,isrcs,track_titles"
              }
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          )}

          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  let parsed: ArtistProvidedCatalogItem[] = [];
                  if (importFormat === "json") parsed = parseCatalogJson(importText);
                  else if (importFormat === "csv") parsed = parseCatalogCsv(importText);
                  else {
                    parsed = [
                      {
                        title: manualTitle,
                        artist_name: manualArtist,
                        upc: manualUpc || null,
                        isrcs: manualIsrc ? [manualIsrc] : [],
                        previous_distributor: previousDistributor || migration.previous_distributor,
                      },
                    ];
                  }
                  const r = await importOwnMigrationItemsAction({
                    migrationId: migration.id,
                    items: parsed,
                    importMethod:
                      importFormat === "json"
                        ? "artist_json"
                        : importFormat === "csv"
                          ? "artist_csv"
                          : "manual",
                  });
                  applyResult(r);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Parse failed");
                }
              })
            }
          >
            Import items
          </Button>
        </div>
      ) : null}

      {migration && (step === "select" || step === "review" || items.length > 0) ? (
        <div className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
          <h2 className="text-h4">Select &amp; Review</h2>
          {items.length === 0 ? (
            <p className="text-small text-[var(--nexo-text-muted)]">No items yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--nexo-border)]">
              {items.map((it) => (
                <li key={it.id} className="flex items-start gap-3 py-3 text-small">
                  <input
                    type="checkbox"
                    checked={it.selected}
                    onChange={() =>
                      setItems((prev) =>
                        prev.map((x) =>
                          x.id === it.id ? { ...x, selected: !x.selected } : x
                        )
                      )
                    }
                    aria-label={`Select ${it.external_title ?? it.id}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {it.external_title || "(missing title)"}
                      {it.external_artist_name ? ` — ${it.external_artist_name}` : ""}
                    </p>
                    <p className="text-caption text-[var(--nexo-text-muted)]">
                      UPC {it.external_upc || "—"} · ISRC{" "}
                      {(it.external_isrcs ?? []).join(", ") || "—"} · {it.status}
                      {it.conflict_reason ? ` · ${it.conflict_reason}` : ""}
                    </p>
                    {(it.metadata_gaps ?? []).length > 0 ? (
                      <p className="text-caption text-amber-600 dark:text-amber-400">
                        Gaps: {(it.metadata_gaps ?? []).join(", ")} (not invented)
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await setMigrationStepAction({
                    migrationId: migration.id,
                    step: "review",
                    selectedItemIds: selectedIds,
                  });
                  applyResult(r);
                })
              }
            >
              Save selection → Review
            </Button>
            <Button
              size="sm"
              disabled={pending || selectedIds.length === 0}
              onClick={() =>
                start(async () => {
                  const stepResult = await setMigrationStepAction({
                    migrationId: migration.id,
                    step: "move_in",
                    selectedItemIds: selectedIds,
                  });
                  if (!stepResult.ok) {
                    applyResult(stepResult);
                    return;
                  }
                  const r = await moveInMigrationAction(migration.id);
                  applyResult(r);
                })
              }
            >
              MOVE IN selected
            </Button>
          </div>
        </div>
      ) : null}

      {err ? (
        <Alert variant="error" title="Error">
          {err}
        </Alert>
      ) : null}
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}
