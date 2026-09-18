"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(portal)/dashboard/notifications/actions";
import { Button } from "@/components/ui/Button";
import type { NotificationRow } from "@/lib/releases/types";

export function NotificationsClient({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState(items);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setRows(items);
  }, [items]);

  async function markOne(id: string) {
    const now = new Date().toISOString();
    const previous = rows;
    setRows((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: item.read_at ?? now } : item))
    );
    setBusy(true);
    try {
      const result = await markNotificationRead(id);
      if (!result.ok) {
        setRows(previous);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    const now = new Date().toISOString();
    const previous = rows;
    setRows((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
    setBusy(true);
    try {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        setRows(previous);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void markAll()}>
          Mark all read
        </Button>
      </div>
      <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
        {rows.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/notifications/${n.id}`}
                className="block rounded-md outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--nexo-text)]"
              >
                <p className={`text-small ${n.read_at ? "text-[var(--nexo-text-muted)]" : "font-medium"}`}>
                  {n.title}
                </p>
                <p className="mt-1 line-clamp-2 text-caption text-[var(--nexo-text-muted)]">
                  {n.body}
                </p>
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                  {new Date(n.created_at).toLocaleString()} · {n.type.replace(/_/g, " ")}
                </p>
                <span className="mt-2 inline-flex text-caption font-medium underline underline-offset-4">
                  Read full notification
                </span>
              </Link>
            </div>
            {!n.read_at ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void markOne(n.id)}>
                Mark read
              </Button>
            ) : (
              <span className="text-caption text-[var(--nexo-text-muted)]">Read</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
