import type { Metadata } from "next";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { RequireAuth } from "@/lib/auth/guards";
import { navForRoles } from "@/lib/auth/nav";
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

  // Unverified users may only stay on profile / verify-email (middleware also enforces)
  const items = navForRoles(ctx.roles);
  const displayName =
    ctx.profile?.display_name || ctx.profile?.full_name || ctx.email || "Account";
  const accountLabel = ctx.roles.map((r) => r.replace(/_/g, " ")).join(" · ");

  return (
    <div className="flex min-h-screen bg-[var(--nexo-bg)]">
      <div className="hidden lg:block">
        <AppSidebar items={items} accountLabel={accountLabel} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar items={items} displayName={displayName} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
