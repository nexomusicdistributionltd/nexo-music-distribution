import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { listCatalogMigrationHistory } from "@/lib/migration/queries";

export const metadata: Metadata = {
  title: "Migration history",
  robots: { index: false, follow: false },
};

export default async function MigrationHistoryPage() {
  await RequireAdmin();
  const rows = await listCatalogMigrationHistory(50);

  return (
    <div>
      <PageHeader
        title="Migration history"
        description="Auditable history. Migrations are never hard-deleted."
      />
      <DistributionNav current="/admin/distribution/history" />
      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No history" description="Completed and archived migrations appear here." />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {rows.map((m) => (
            <li key={m.id} className="px-4 py-3 text-small">
              <p className="font-medium">{m.title || m.id}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {m.status}
                {m.archived_at ? " · archived" : ""}
                {" · "}
                {new Date(m.created_at).toISOString()}
                {" · imported "}
                {m.imported_count}
                {m.old_distributor_takedown_offered ? " · old takedown offered" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
