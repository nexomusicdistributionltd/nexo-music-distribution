import type { Metadata } from "next";
import { PortalFeaturePage } from "@/components/portal/PortalFeaturePage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sales", robots: { index: false, follow: false } };

export default function SalesPage() {
  return <PortalFeaturePage href="/sales" />;
}
