import type { Metadata } from "next";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { PortalChrome } from "@/components/portal/PortalChrome";
import { RealtimeRefresh } from "@/components/notifications/RealtimeRefresh";
import { RequireAuth } from "@/lib/auth/guards";
import {
  navSectionsForRoles,
  workspaceKindForRoles,
} from "@/lib/auth/nav";
import { applyNavBadgeCounts, navCountForHref } from "@/lib/auth/nav-badges";
import { getNavBadgeCounts } from "@/lib/auth/nav-badges.server";
import { accountOverlayItems } from "@/lib/portal/ia";
import { getLabelProfileForUser } from "@/lib/roster/queries";
import { isBlockedStatus } from "@/lib/auth/types";
import { redirect } from "next/navigation";
import { getIdentityVerificationForUser } from "@/lib/identity/queries";
import { createClient } from "@/lib/supabase/server";
import { PortalAnnouncements } from "@/components/portal/PortalAnnouncements";
import { isFeatureEnabled } from "@/lib/admin/feature-flags";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function hasCurrentDistributionAgreement(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "has_current_distribution_agreement",
    { p_user_id: userId }
  );
  return !error && data === true;
}

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
  const rawSections = navSectionsForRoles(ctx.roles);
  const displayName =
    ctx.profile?.display_name || ctx.profile?.full_name || ctx.email || "Account";
  const accountLabel = ctx.roles.map((r) => r.replace(/_/g, " ")).join(" · ");
  const isPortalWorkspace = workspaceKind === "artist" || workspaceKind === "label";

  const [badgeCounts, label, identityVerification, agreementReady, maintenanceMode] = await Promise.all([
    getNavBadgeCounts(),
    workspaceKind === "label"
      ? getLabelProfileForUser(ctx.userId)
      : Promise.resolve(null),
    isPortalWorkspace
      ? getIdentityVerificationForUser(ctx.userId)
      : Promise.resolve(null),
    isPortalWorkspace
      ? hasCurrentDistributionAgreement(ctx.userId)
      : Promise.resolve(true),
    isFeatureEnabled("maintenance_mode", false),
  ]);
  const sections = applyNavBadgeCounts(rawSections, badgeCounts);
  const unread = navCountForHref(badgeCounts, "/dashboard/notifications");
  const unreadMessages = navCountForHref(badgeCounts, "/support");

  let headerName = displayName;
  let labelName: string | null = null;
  if (label?.label_name) {
    headerName = label.label_name;
    labelName = label.label_name;
  }

  if (isPortalWorkspace && identityVerification?.status !== "verified") {
    redirect("/verify-identity");
  }

  if (isPortalWorkspace && !agreementReady) {
    redirect("/distribution-agreement");
  }

  if (isPortalWorkspace) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--nexo-bg)]">
        <PortalChrome
          sections={sections}
          accountItems={accountOverlayItems(workspaceKind)}
          displayName={headerName}
          workspaceKind={workspaceKind}
          unreadNotifications={unread}
          unreadMessages={unreadMessages}
          labelName={labelName}
          identityVerified={identityVerification?.status === "verified"}
        />
        <RealtimeRefresh userId={ctx.userId} />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:ml-[18.5rem] lg:px-8">
          {maintenanceMode ? (
            <div className="mb-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-warning)]/40 bg-[var(--nexo-warning-bg)] px-4 py-3 text-small">
              Nexo maintenance mode is active. Some services may be temporarily unavailable.
            </div>
          ) : null}
          <PortalAnnouncements userId={ctx.userId} />
          {children}
        </main>
      </div>
    );
  }

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
          unreadMessages={unreadMessages}
        />
        <RealtimeRefresh userId={ctx.userId} />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
