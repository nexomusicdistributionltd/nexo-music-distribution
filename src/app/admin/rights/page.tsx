import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { OpsCaseCenter } from "@/components/admin/OpsCaseCenter";

export const metadata: Metadata = { title: "Rights & Claims", robots: { index:false, follow:false } };

export default async function RightsPage() {
  await RequireAdminPermission("admin:operations");
  return <div className="space-y-6">
    <PageHeader title="Rights & Claims" description="DMCA, copyright, ownership, impersonation, artwork, sample and rightsholder disputes with evidence, holds and a full case timeline." />
    <OpsCaseCenter caseType="rights_claim" createLabel="Open rights claim" />
  </div>;
}
