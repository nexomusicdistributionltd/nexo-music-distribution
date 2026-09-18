import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { BroadcastAdminClient } from "@/components/notifications/BroadcastAdminClient";

export const metadata: Metadata = {
  title: "Admin notifications",
  robots: { index: false, follow: false },
};

export default async function AdminNotificationsPage() {
  const ctx = await RequireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: broadcasts }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("notification_broadcasts")
      .select("id,title,body,audience,created_at,published_at,recipient_count")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Staff inbox and server-side realtime broadcasts to Artist and Label accounts."
      />
      <div className="mt-5">
        <BroadcastAdminClient broadcasts={broadcasts ?? []} />
      </div>
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
