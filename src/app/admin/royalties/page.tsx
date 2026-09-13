import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnits } from "@/lib/finance/money";

export const metadata: Metadata = {
  title: "Royalties",
  robots: { index: false, follow: false },
};

export default async function RoyaltiesPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("royalty_statements")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Royalties"
        description="Statements and line items. Adjustments only — no silent deletes."
      />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No financial data available yet" description="Royalty statements will list here when published." />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(data ?? []).map((s) => (
            <li key={s.id} className="flex justify-between px-4 py-3 text-small">
              <span>
                {s.period_start} → {s.period_end} · {s.status}
              </span>
              <span className="tabular-nums">
                {formatMinorUnits(s.total_minor, s.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
