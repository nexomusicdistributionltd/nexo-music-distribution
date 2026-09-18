"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { savePortalFeatureControlAction } from "@/app/admin/portal-features/actions";

export type PortalFeatureControlRow = {
  href: string;
  label: string;
  enabledArtist: boolean;
  enabledLabel: boolean;
  adminNote: string;
};

export function PortalFeatureControlsClient({ rows }: { rows: PortalFeatureControlRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <div className="space-y-3">
      {message ? <p className="text-small text-[var(--nexo-text-muted)]">{message}</p> : null}
      {rows.map((row) => (
        <form
          key={row.href}
          className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_minmax(14rem,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await savePortalFeatureControlAction({
                href: row.href,
                label: row.label,
                enabledArtist: form.get("artist") === "on",
                enabledLabel: form.get("label") === "on",
                adminNote: String(form.get("note") || ""),
              });
              setMessage(result.ok ? `${row.label} updated.` : result.error);
              if (result.ok) router.refresh();
            });
          }}
        >
          <div className="min-w-0">
            <p className="font-medium">{row.label}</p>
            <p className="truncate text-caption text-[var(--nexo-text-muted)]">{row.href}</p>
          </div>
          <label className="flex items-center gap-2 text-small">
            <input name="artist" type="checkbox" defaultChecked={row.enabledArtist} /> Artist
          </label>
          <label className="flex items-center gap-2 text-small">
            <input name="label" type="checkbox" defaultChecked={row.enabledLabel} /> Label
          </label>
          <Input name="note" defaultValue={row.adminNote} placeholder="Internal note (optional)" />
          <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </form>
      ))}
    </div>
  );
}
