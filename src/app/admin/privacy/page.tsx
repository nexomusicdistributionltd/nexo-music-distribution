import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { OpsCaseCenter } from "@/components/admin/OpsCaseCenter";

export const metadata: Metadata = { title: "Privacy Requests", robots: { index:false, follow:false } };

export default async function PrivacyPage() {
  await RequireAdminPermission("admin:compliance");
  return <div className="space-y-6">
    <PageHeader title="Privacy & Data Requests" description="Track access, export, correction, deletion and retention/legal-hold requests with owners, due dates and evidence." />
    <OpsCaseCenter caseType="privacy_request" createLabel="Open privacy request" />
  </div>;
}
