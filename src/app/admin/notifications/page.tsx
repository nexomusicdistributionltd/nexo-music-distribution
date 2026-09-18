import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { BroadcastNotificationForm } from "@/components/admin/BroadcastNotificationForm";

export const metadata: Metadata = {
  title: "Admin notifications",
  robots: { index: false, follow: false },
};

export default async function AdminNotificationsPage() {
  const ctx = await RequireAdmin();
  const supabase = await createClient();
  const service = createServiceClient();
  const [{ data }, { data: broadcasts }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(50),
    service
      .from("notification_broadcasts")
      .select("id,title,audience,recipient_count,published_at,created_at")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Your staff inbox. System notifications are never forged for other users from the client."
      />
      <div className="mt-6">
        <BroadcastNotificationForm />
      </div>
      {(broadcasts ?? []).length > 0 ? (
        <section className="mt-6 space-y-2">
          <h2 className="text-h4">Recent broadcasts</h2>
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {(broadcasts ?? []).map((broadcast) => (
              <li key={broadcast.id} className="px-4 py-3 text-small">
                <p className="font-medium">{broadcast.title}</p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {broadcast.audience} · {broadcast.recipient_count} recipient(s) ·{" "}
                  {new Date(broadcast.published_at || broadcast.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <h2 className="mt-6 text-h4">Staff inbox</h2>
      {(data ?? []).length === 0 ? (
        <EmptyState title="No notifications" />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(data ?? []).map((n) => (
            <li key={n.id} className="px-4 py-3 text-small">
              <p className="font-medium">{n.title}</p>
              <p className="text-[var(--nexo-text-secondary)]">{n.body}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {n.type} · {new Date(n.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
