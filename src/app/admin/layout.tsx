import type { Metadata } from "next";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { RealtimeRefresh } from "@/components/notifications/RealtimeRefresh";
import { RequireAdmin } from "@/lib/auth/guards";
import { navForRoles } from "@/lib/auth/nav";

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
  const items = navForRoles(ctx.roles);
  const displayName =
    ctx.profile?.display_name || ctx.profile?.full_name || ctx.email || "Admin";

  return (
    <div className="flex min-h-screen bg-[var(--nexo-bg)]">
      <div className="hidden lg:block">
        <AppSidebar items={items} accountLabel="Admin" logoHref="/admin" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar items={items} displayName={displayName} />
        <RealtimeRefresh userId={ctx.userId} staff />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
