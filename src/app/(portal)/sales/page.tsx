import type { Metadata } from "next";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { SalesDashboard } from "@/components/portal/SalesDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales Overview",
  robots: { index: false, follow: false },
};

export default async function SalesOverviewPage() {
  const ctx = await RequireVerifiedPortal();
  return <SalesDashboard ownerUserId={ctx.userId} view="overview" />;
}
