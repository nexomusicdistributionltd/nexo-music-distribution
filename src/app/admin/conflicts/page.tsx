import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { OpsCaseCenter } from "@/components/admin/OpsCaseCenter";

export const metadata: Metadata = { title: "Catalog Conflicts", robots: { index:false, follow:false } };

export default async function ConflictsPage() {
  await RequireAdminPermission("admin:operations");
  return <div className="space-y-6">
    <PageHeader title="Catalog Conflict Center" description="Track duplicate ISRC/UPC, ownership, artist identity, migration and DSP catalog conflicts independently from normal QC." />
    <OpsCaseCenter caseType="catalog_conflict" createLabel="Open catalog conflict" />
  </div>;
}
