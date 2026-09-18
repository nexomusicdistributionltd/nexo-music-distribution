import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Notification",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function NotificationDetailPage({ params }: Props) {
  const { id } = await params;
  const ctx = await RequireRole(["artist", "label"]);
  const supabase = await createClient();

  const { data: notification, error } = await supabase
    .from("notifications")
    .select("id, title, body, type, read_at, created_at")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error || !notification) notFound();

  if (!notification.read_at) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", ctx.userId)
      .is("read_at", null);
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/notifications"
        className="inline-flex text-small font-medium underline underline-offset-4"
      >
        ← Back to notifications
      </Link>

      <header className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 shadow-[var(--nexo-shadow-sm)]">
        <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
          {String(notification.type).replace(/_/g, " ")}
        </p>
        <h1 className="mt-2 text-h2">{notification.title}</h1>
        <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
          {new Date(notification.created_at).toLocaleString()}
        </p>
      </header>

      <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-6">
        <div className="whitespace-pre-wrap text-body leading-7 text-[var(--nexo-text-secondary)]">
          {notification.body}
        </div>
      </section>
    </article>
  );
}
