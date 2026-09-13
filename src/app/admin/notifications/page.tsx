import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin notifications",
  robots: { index: false, follow: false },
};

export default async function AdminNotificationsPage() {
  const ctx = await RequireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Your staff inbox. System notifications are never forged for other users from the client."
      />
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
