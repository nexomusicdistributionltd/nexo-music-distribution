"use client";

import Link from "next/link";
import * as React from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(portal)/dashboard/notifications/actions";
import { Button } from "@/components/ui/Button";
import type { NotificationRow } from "@/lib/releases/types";

export function NotificationsClient({ items }: { items: NotificationRow[] }) {
  const [rows, setRows] = React.useState(items);
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());
  const [allBusy, setAllBusy] = React.useState(false);

  React.useEffect(() => setRows(items), [items]);

  async function markOne(id: string) {
    const now = new Date().toISOString();
    const previous = rows;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, read_at: now } : row)));
    setBusyIds((current) => new Set(current).add(id));
    const result = await markNotificationRead(id);
    if (!result.ok) setRows(previous);
    setBusyIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  async function markAll() {
    const now = new Date().toISOString();
    const previous = rows;
    setRows((current) => current.map((row) => ({ ...row, read_at: row.read_at ?? now })));
    setAllBusy(true);
    const result = await markAllNotificationsRead();
    if (!result.ok) setRows(previous);
    setAllBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={allBusy || rows.every((row) => Boolean(row.read_at))}
          onClick={() => void markAll()}
        >
          {allBusy ? "Marking…" : "Mark all read"}
        </Button>
      </div>
      <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
        {rows.map((n) => {
          const href = `/dashboard/notifications/${n.id}`;
          return (
            <li key={n.id} className="flex items-start justify-between gap-3 p-4">
              <Link href={href} className="min-w-0 flex-1" onClick={() => !n.read_at && void markOne(n.id)}>
                <p className={`text-small ${n.read_at ? "text-[var(--nexo-text-muted)]" : "font-medium"}`}>
                  {n.title}
                </p>
                <p className="mt-1 line-clamp-2 text-caption text-[var(--nexo-text-muted)]">{n.body}</p>
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                  {new Date(n.created_at).toLocaleString()} · {n.type.replace(/_/g, " ")}
                </p>
              </Link>
              {!n.read_at ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyIds.has(n.id)}
                  onClick={() => void markOne(n.id)}
                >
                  {busyIds.has(n.id) ? "…" : "Mark read"}
                </Button>
              ) : (
                <span className="text-caption text-[var(--nexo-text-muted)]">Read</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
