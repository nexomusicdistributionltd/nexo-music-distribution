import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getProviderConnectionState } from "@/lib/provider";
import { listCatalogMigrations } from "@/lib/migration/queries";
import { defaultUnavailableCatalog } from "@/lib/migration/external-catalog";
import { EXISTING_TRACK_PROMPT } from "@/lib/migration/duplicates";
import { MigrationClient } from "@/components/distribution/MigrationClient";

export const metadata: Metadata = {
  title: "Catalog migration",
  robots: { index: false, follow: false },
};

export default async function MigrationPage() {
  await RequireAdmin();
  const provider = getProviderConnectionState();
  const migrations = await listCatalogMigrations(30);
  const discovery = defaultUnavailableCatalog();

  return (
    <div>
      <PageHeader
        title="Catalog migration"
        description="Import from external catalogs without inventing releases. Old-distributor takedown is never automatic."
      />
      <DistributionNav current="/admin/distribution/migration" />
      <ProviderBanner connected={provider.connected} />

      {!discovery.available ? (
        <Alert variant="warning" title="External catalog unavailable" className="mt-4">
          {discovery.reason}
        </Alert>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Start migration</CardTitle>
        </CardHeader>
        <CardContent>
          <MigrationClient />
          <p className="mt-3 text-caption text-[var(--nexo-text-muted)]">
            Duplicate detection prompts: “{EXISTING_TRACK_PROMPT}” when ISRC/hash matches.
            ISRC/UPC are preserved when valid — never auto-generated.
          </p>
        </CardContent>
      </Card>

      <h2 className="mt-8 text-h4">Active migrations</h2>
      {migrations.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="No migrations"
            description="Create a migration run. Discovery stays unavailable until an external source is connected."
          />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {migrations.map((m) => (
            <li key={m.id} className="px-4 py-3 text-small">
              <p className="font-medium">{m.title || m.id}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {m.status} · step {(m as { workflow_step?: string }).workflow_step || "—"} ·
                source {m.source_name}
                {(m as { previous_distributor?: string | null }).previous_distributor
                  ? ` · prev ${(m as { previous_distributor?: string }).previous_distributor}`
                  : ""}
                {m.external_catalog_unavailable_reason
                  ? ` · ${m.external_catalog_unavailable_reason}`
                  : ""}
                {" · "}items {m.item_count} · conflicts {m.conflict_count}
                {(m as { last_job_status?: string | null }).last_job_status
                  ? ` · job ${(m as { last_job_status?: string }).last_job_status}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
