import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/app/ComingSoonPanel";
import { Alert } from "@/components/ui/Alert";
import { RequireVerifiedEmail } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const ctx = await RequireVerifiedEmail();
  const name = ctx.profile?.display_name || ctx.profile?.full_name || "there";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2">Dashboard</h1>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          Welcome back, {name}.
        </p>
      </div>
      <Alert title="Portal shell">
        Releases, earnings, analytics, and distribution connections are not wired in this batch.
        Navigation is real; data modules stay empty on purpose.
      </Alert>
      <ComingSoonPanel title="No releases yet" description="When distribution is connected, your catalog overview will appear here." />
    </div>
  );
}
