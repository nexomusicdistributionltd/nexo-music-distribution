"use client";

import Link from "next/link";
import * as React from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(portal)/dashboard/notifications/actions";
import { Button } from "@/components/ui/Button";
import type { NotificationRow } from "@/lib/releases/types";
import { createClient } from "@/lib/supabase/client";

export function NotificationsClient({
  items,
  userId,
}: {
  items: NotificationRow[];
  userId: string;
}) {
  const [rows, setRows] = React.useState(items);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setRows(items), [items]);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as NotificationRow;
            setRows((current) =>
              current.some((row) => row.id === next.id) ? current : [next, ...current]
            );
          } else if (payload.eventType === "UPDATE") {
            const next = payload.new as NotificationRow;
            setRows((current) => current.map((row) => (row.id === next.id ? next : row)));
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<NotificationRow>;
            setRows((current) => current.filter((row) => row.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function markOne(id: string) {
    const before = rows;
    const readAt = new Date().toISOString();
    setRows((current) => current.map((row) => (row.id === id ? { ...row, read_at: readAt } : row)));
    const result = await markNotificationRead(id);
    if (!result.ok) setRows(before);
  }

  async function markAll() {
    setBusy(true);
    const before = rows;
    const readAt = new Date().toISOString();
    setRows((current) => current.map((row) => ({ ...row, read_at: row.read_at ?? readAt })));
    try {
      const result = await markAllNotificationsRead();
      if (!result.ok) setRows(before);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void markAll()}>
          {busy ? "Marking…" : "Mark all read"}
        </Button>
      </div>
      <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
        {rows.map((notification) => (
          <li key={notification.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/dashboard/notifications/${notification.id}`}
                onClick={() => void markOne(notification.id)}
                className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-accent)]"
              >
                <p className={`text-small ${notification.read_at ? "text-[var(--nexo-text-muted)]" : "font-medium"}`}>
                  {notification.title}
                </p>
                <p className="mt-1 line-clamp-2 text-caption text-[var(--nexo-text-muted)]">
                  {notification.body}
                </p>
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                  {new Date(notification.created_at).toLocaleString()} · {notification.type.replace(/_/g, " ")}
                </p>
              </Link>
              {!notification.read_at ? (
                <Button variant="ghost" size="sm" onClick={() => void markOne(notification.id)}>
                  Mark read
                </Button>
              ) : (
                <span className="text-caption text-[var(--nexo-text-muted)]">Read</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
