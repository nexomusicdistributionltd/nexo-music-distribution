"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  updateMusicVideoRequestAction,
  updatePortalServiceRequestAction,
} from "@/app/admin/portal-requests/actions";

export type PortalReviewRow = {
  id: string;
  type: "service" | "video";
  title: string;
  kind: string;
  status: string;
  adminNote: string | null;
  ownerLabel: string;
  createdAt: string;
};

export function PortalRequestReviewClient({ rows }: { rows: PortalReviewRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <div className="space-y-3">
      {message ? <p className="text-small text-[var(--nexo-text-muted)]">{message}</p> : null}
      {rows.map((row) => (
        <form
          key={`${row.type}:${row.id}`}
          className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4 lg:grid-cols-[1fr_12rem_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            const status = String(fd.get("status") || row.status);
            const adminNote = String(fd.get("admin_note") || "");
            startTransition(async () => {
              const result =
                row.type === "service"
                  ? await updatePortalServiceRequestAction({ id: row.id, status, adminNote })
                  : await updateMusicVideoRequestAction({ id: row.id, status, adminNote });
              setMessage(result.ok ? "Request updated and account notified." : result.error);
              if (result.ok) router.refresh();
            });
          }}
        >
          <div className="min-w-0">
            <p className="font-medium">{row.title}</p>
            <p className="text-caption text-[var(--nexo-text-muted)]">
              {row.kind.replace(/_/g, " ")} · {row.ownerLabel} · {new Date(row.createdAt).toLocaleString()}
            </p>
          </div>
          <Select name="status" defaultValue={row.status}>
            <option value="submitted">Submitted</option>
            <option value="reviewing">Reviewing</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </Select>
          <Input name="admin_note" defaultValue={row.adminNote ?? ""} placeholder="Message / reason for client" />
          <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Update"}</Button>
        </form>
      ))}
    </div>
  );
}
