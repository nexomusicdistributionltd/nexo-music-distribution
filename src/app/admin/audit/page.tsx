import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Audit log",
  robots: { index: false, follow: false },
};

export default async function AuditPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <PageHeader title="Audit" description="Immutable operational audit trail (no secrets)." />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No audit events yet" />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] text-small">
          {(data ?? []).map((row) => (
            <li key={row.id} className="px-4 py-3">
              <p className="font-medium">{row.action}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {row.entity_type} {row.entity_id ?? ""} ·{" "}
                {new Date(row.created_at).toLocaleString()} · actor{" "}
                {row.actor_user_id ?? "system"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
