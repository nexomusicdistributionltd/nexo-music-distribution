import type { Metadata } from "next";
import { PortalFeaturePage } from "@/components/portal/PortalFeaturePage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reports", robots: { index: false, follow: false } };

export default function ReportsPage() {
  return <PortalFeaturePage href="/reports" />;
}
