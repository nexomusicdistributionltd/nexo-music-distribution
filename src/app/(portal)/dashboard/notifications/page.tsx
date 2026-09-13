import type { Metadata } from "next";
import { NotificationsClient } from "@/components/notifications/NotificationsClient";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequireRole } from "@/lib/auth/guards";
import { listNotifications } from "@/lib/releases/queries";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const ctx = await RequireRole(["artist", "label"]);
  const items = await listNotifications(ctx.userId, 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2">Notifications</h1>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          In-app only — no external email is sent from this batch.
        </p>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No notifications" description="QC and status updates will show up here." />
      ) : (
        <NotificationsClient items={items} />
      )}
    </div>
  );
}
