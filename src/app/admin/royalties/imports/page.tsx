import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/server";
import { FinanceNav } from "@/components/finance/FinanceNav";
import { CreateImportBatchForm } from "@/components/finance/CreateImportBatchForm";
import { PostRoyaltyBatchButton } from "@/components/finance/PostRoyaltyBatchButton";

export const metadata: Metadata = {
  title: "Royalty imports",
  robots: { index: false, follow: false },
};

export default async function RoyaltyImportsPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("royalty_import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Royalty imports"
        description="Idempotent by source + report + row. No sample/demo import data."
      />
      <FinanceNav />
      <Alert title="Provider settlement imports">
        Live TooLost sales reporting is read separately from settlement posting. Only confirmed report rows with an explicit currency should be matched and posted into the Nexo ledger; estimated sales are never promoted into withdrawable balances.
      </Alert>
      <div className="mt-4">
        <CreateImportBatchForm />
      </div>
      {(data ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No import batches"
            description="Create a batch when a real provider report is available."
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(data ?? []).map((b) => (
            <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-small">
              <div>
                <p className="font-medium">
                  {b.source_provider} · {b.report_id}
                </p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {b.status} · rows {b.row_count} · matched {b.matched_count} · conflicts{" "}
                  {b.conflict_count} · posted {b.posted_count}
                </p>
              </div>
              <PostRoyaltyBatchButton batchId={b.id} disabled={b.status === "processing"} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
