import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { CreateComplianceForm } from "@/components/admin/CreateComplianceForm";

export const metadata: Metadata = {
  title: "Compliance",
  robots: { index: false, follow: false },
};

export default async function CompliancePage() {
  await RequireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("compliance_cases")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Cases and private evidence storage (signed URLs only)."
      />
      <CreateComplianceForm />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No compliance cases" description="Open a case when a rights or policy issue needs tracking." />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(data ?? []).map((c) => (
            <li key={c.id} className="px-4 py-3 text-small">
              <p className="font-medium">{c.title}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {c.status} · {new Date(c.created_at).toLocaleString()}
              </p>
              {c.summary ? <p className="mt-1">{c.summary}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
