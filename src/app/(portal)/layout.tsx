import type { Metadata } from "next";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { RealtimeRefresh } from "@/components/notifications/RealtimeRefresh";
import { RequireAuth } from "@/lib/auth/guards";
import {
  navSectionsForRoles,
  workspaceKindForRoles,
} from "@/lib/auth/nav";
import { countUnreadNotifications } from "@/lib/releases/queries";
import { getLabelProfileForUser } from "@/lib/roster/queries";
import { isBlockedStatus } from "@/lib/auth/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await RequireAuth({ redirectTo: "/login" });

  if (isBlockedStatus(ctx.profile?.account_status)) {
    redirect("/login?reason=account-blocked");
  }

  const workspaceKind = workspaceKindForRoles(ctx.roles);
  const sections = navSectionsForRoles(ctx.roles);
  const displayName =
    ctx.profile?.display_name || ctx.profile?.full_name || ctx.email || "Account";
  const accountLabel = ctx.roles.map((r) => r.replace(/_/g, " ")).join(" · ");
  const unread = await countUnreadNotifications(ctx.userId).catch(() => 0);

  let headerName = displayName;
  if (workspaceKind === "label") {
    const label = await getLabelProfileForUser(ctx.userId);
    if (label?.label_name) headerName = label.label_name;
  }

  const isPortalWorkspace = workspaceKind === "artist" || workspaceKind === "label";

  return (
    <div className="flex min-h-screen bg-[var(--nexo-bg)]">
      <div className="sticky top-0 hidden h-screen lg:block">
        <AppSidebar
          sections={sections}
          accountLabel={accountLabel}
          displayName={headerName}
          workspaceKind={workspaceKind}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          sections={sections}
          displayName={headerName}
          workspaceKind={workspaceKind}
          unreadNotifications={unread}
          notificationsHref={isPortalWorkspace ? "/dashboard/notifications" : undefined}
          messagesHref={isPortalWorkspace ? "/support" : undefined}
          quickAction={
            isPortalWorkspace
              ? { href: "/dashboard/releases/new", label: "New release" }
              : null
          }
        />
        <RealtimeRefresh userId={ctx.userId} />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
