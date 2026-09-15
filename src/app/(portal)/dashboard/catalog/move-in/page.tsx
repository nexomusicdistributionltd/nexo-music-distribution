import type { Metadata } from "next";
import Link from "next/link";
import { RequireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { MoveInClient } from "@/components/migration/MoveInClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { defaultUnavailableCatalog } from "@/lib/migration/external-catalog";
import { CatalogMigrationLocked } from "@/components/billing/CatalogMigrationLocked";
import { hasCatalogMigrationAccess } from "@/lib/billing/feature-access";
import { safeGetEntitlementsForAuth } from "@/lib/billing/queries";
import { billingAccountTypeFromRoles } from "@/lib/billing/eligibility";

export const metadata: Metadata = {
  title: "Move In Catalog",
  robots: { index: false, follow: false },
};

export default async function MoveInCatalogPage() {
  const ctx = await RequireAuth({ redirectTo: "/login" });
  const entitlements = await safeGetEntitlementsForAuth(ctx);
  const entitled = hasCatalogMigrationAccess(entitlements);
  const supabase = await createClient();
  const { data: migrations } = await supabase
    .from("catalog_migrations")
    .select(
      "id, title, status, workflow_step, previous_distributor, import_method, last_job_status, last_job_message, last_job_at, item_count, conflict_count, imported_count, created_at"
    )
    .eq("owner_user_id", ctx.userId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const latest = migrations?.[0] ?? null;
  let items: Parameters<typeof MoveInClient>[0]["initialItems"] = [];
  if (latest) {
    const { data } = await supabase
      .from("catalog_migration_items")
      .select(
        "id, external_title, external_artist_name, external_upc, external_isrcs, status, selected, metadata_gaps, conflict_reason, draft_release_id"
      )
      .eq("migration_id", latest.id)
      .order("created_at", { ascending: true });
    items = (data ?? []) as typeof items;
  }

  const discovery = defaultUnavailableCatalog();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-h2">Move In Catalog</h1>
        <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
          Search → Select → Review → MOVE IN. Uses Batch 6 catalog migration —
          no invented Spotify/Apple results, no invented ISRC/UPC, real job status.
        </p>
      </div>

      {!entitled ? (
        <CatalogMigrationLocked
          accountType={
            entitlements.accountType ??
            billingAccountTypeFromRoles(ctx.roles, ctx.profile?.account_type)
          }
        />
      ) : !discovery.available ? (
        <Alert variant="warning" title="External catalog API">
          {discovery.reason} You can still import via JSON, CSV, or manual metadata.
        </Alert>
      ) : null}

      {entitled ? <MoveInClient initialMigration={latest} initialItems={items} /> : null}

      {(migrations?.length ?? 0) > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your migration history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-[var(--nexo-border)] text-small">
              {migrations!.map((m) => (
                <li key={m.id} className="py-3">
                  <Link
                    href={`/dashboard/catalog/move-in/${m.id}`}
                    className="font-medium hover:underline"
                  >
                    {m.title || m.id}
                  </Link>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {m.status} · step {m.workflow_step} · prev{" "}
                    {m.previous_distributor || "—"} · items {m.item_count} ·
                    imported {m.imported_count} · conflicts {m.conflict_count}
                    {m.last_job_status ? ` · job ${m.last_job_status}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
