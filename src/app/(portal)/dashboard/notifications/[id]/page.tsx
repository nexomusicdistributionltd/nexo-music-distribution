import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Notification",
  robots: { index: false, follow: false },
};

export default async function NotificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await RequireAuth();
  const { id } = await params;
  const supabase = await createClient();

  const { data: notification } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!notification) notFound();

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
      <div>
        <Link
          href="/dashboard/notifications"
          className="text-small text-[var(--nexo-text-muted)] underline-offset-4 hover:underline"
        >
          ← Back to notifications
        </Link>
        <h1 className="mt-4 text-h2">{notification.title}</h1>
        <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
          {new Date(notification.created_at).toLocaleString()} · {String(notification.type).replace(/_/g, " ")}
        </p>
      </div>
      <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 sm:p-7">
        <div className="whitespace-pre-wrap text-small leading-7">{notification.body}</div>
      </section>
    </article>
  );
}
