import { navSectionsForRoles } from "@/lib/auth/nav";
import { applyNavBadgeCounts, navCountForHref } from "@/lib/auth/nav-badges";
import { getNavBadgeCounts } from "@/lib/auth/nav-badges.server";
import { getEffectiveAdminPermissionsForContext } from "@/lib/admin/staff-access";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { RealtimeRefresh } from "@/components/notifications/RealtimeRefresh";
import { RequireAdmin } from "@/lib/auth/guards";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await RequireAdmin();
  const [permissions, badgeCounts] = await Promise.all([
    getEffectiveAdminPermissionsForContext(ctx),
    getNavBadgeCounts(),
  ]);
  const sections = applyNavBadgeCounts(
    navSectionsForRoles(ctx.roles, permissions),
    badgeCounts
  );
  const displayName =
    ctx.profile?.display_name || ctx.profile?.full_name || ctx.email || "Admin";
  const unread = navCountForHref(badgeCounts, "/admin/notifications");
  const unreadMessages = navCountForHref(badgeCounts, "/admin/support");

  return (
    <div className="flex min-h-screen bg-[var(--nexo-bg)]">
      <div className="sticky top-0 hidden h-screen lg:block">
        <AppSidebar
          sections={sections}
          accountLabel={ctx.roles.map((r) => r.replace(/_/g, " ")).join(" · ")}
          displayName={displayName}
          workspaceKind="admin"
          logoHref="/admin"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          sections={sections}
          displayName={displayName}
          workspaceKind="admin"
          logoHref="/admin"
          showSearch
          unreadNotifications={unread}
          unreadMessages={unreadMessages}
          notificationsHref="/admin/notifications"
          messagesHref="/admin/support"
        />
        <RealtimeRefresh userId={ctx.userId} staff />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
