import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notification",
  robots: { index: false, follow: false },
};

export default async function NotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await RequireRole(["artist", "label"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: notification, error } = await supabase
    .from("notifications")
    .select("id,type,title,body,entity_type,entity_id,read_at,created_at")
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
    <main className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/dashboard/notifications"
          className="text-small text-[var(--nexo-text-muted)] underline-offset-4 hover:underline"
        >
          ← Back to notifications
        </Link>
      </div>
      <article className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 shadow-[var(--nexo-shadow-sm)] sm:p-8">
        <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
          {String(notification.type).replace(/_/g, " ")} · {new Date(notification.created_at).toLocaleString()}
        </p>
        <h1 className="mt-3 text-h2">{notification.title}</h1>
        <div className="mt-6 whitespace-pre-wrap text-small leading-7 text-[var(--nexo-text-secondary)]">
          {notification.body}
        </div>
      </article>
    </main>
  );
}
