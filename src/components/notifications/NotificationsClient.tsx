"use client";

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
  const [busy, setBusy] = React.useState(false);

  async function markOne(id: string) {
    setBusy(true);
    try {
      await markNotificationRead(id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
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
        {items.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className={`text-small ${n.read_at ? "text-[var(--nexo-text-muted)]" : "font-medium"}`}>
                {n.title}
              </p>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{n.body}</p>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                {new Date(n.created_at).toLocaleString()} · {n.type.replace(/_/g, " ")}
              </p>
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
