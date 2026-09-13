import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { ReportRequestForm } from "@/components/admin/ReportRequestForm";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

export default async function ReportsPage() {
  await RequireAdminPermission("admin:reports");
  const supabase = await createClient();
  const { data } = await supabase
    .from("report_exports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Exports are authorized and audited. Sensitive exports leave an audit row."
      />
      <ReportRequestForm />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No report exports yet" />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] text-small">
          {(data ?? []).map((r) => (
            <li key={r.id} className="px-4 py-3">
              {r.report_type} · {r.status} · {new Date(r.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
