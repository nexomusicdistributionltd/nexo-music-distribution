import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireRole } from "@/lib/auth/guards";
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
  const ctx = await RequireRole(["artist", "label"]);
  const { id } = await params;
  const supabase = await createClient();
  const { data: notification } = await supabase
    .from("notifications")
    .select("id,title,body,type,created_at,read_at,action_path")
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
        <Link href="/dashboard/notifications" className="text-caption text-[var(--nexo-text-muted)] underline-offset-4 hover:underline">
          Back to notifications
        </Link>
        <p className="mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--nexo-text-muted)]">
          {String(notification.type).replace(/_/g, " ")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{notification.title}</h1>
        <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
          {new Date(notification.created_at).toLocaleString()}
        </p>
      </div>
      <div className="whitespace-pre-wrap rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 text-small leading-7">
        {notification.body}
      </div>
      {notification.action_path ? (
        <Link
          href={notification.action_path}
          className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-text)] px-4 text-small font-semibold [color:var(--nexo-text-inverse)]"
        >
          Open related page
        </Link>
      ) : null}
    </article>
  );
}
