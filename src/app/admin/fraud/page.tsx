import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { OpsCaseCenter } from "@/components/admin/OpsCaseCenter";

export const metadata: Metadata = { title: "Fraud & Streaming Risk", robots: { index:false, follow:false } };

export default async function FraudPage() {
  await RequireAdminPermission("admin:operations");
  return <div className="space-y-6">
    <PageHeader title="Fraud & Streaming Risk" description="Investigate artificial streaming, suspicious account behavior, payout risk and abuse without silently changing catalog or royalty records." />
    <OpsCaseCenter caseType="fraud_review" createLabel="Open fraud review" />
  </div>;
}
