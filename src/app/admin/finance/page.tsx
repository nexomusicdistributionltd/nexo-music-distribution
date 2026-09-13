import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnits } from "@/lib/finance/money";

export const metadata: Metadata = {
  title: "Finance",
  robots: { index: false, follow: false },
};

export default async function FinancePage() {
  await RequireAdmin();
  const supabase = await createClient();
  const [{ count: ledgerCount }, { data: recent }] = await Promise.all([
    supabase.from("ledger_entries").select("id", { count: "exact", head: true }),
    supabase
      .from("ledger_entries")
      .select("id, amount_minor, currency, kind, description, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Ledger uses integer minor units + ISO currency. No casual edit/delete."
      />
      <div className="mb-4 flex gap-3 text-small">
        <Link href="/admin/royalties" className="underline-offset-4 hover:underline">
          Royalties
        </Link>
        <Link href="/admin/payouts" className="underline-offset-4 hover:underline">
          Payouts
        </Link>
      </div>
      {(ledgerCount ?? 0) === 0 ? (
        <EmptyState
          title="No financial data available yet"
          description="Ledger entries appear when royalty imports or adjustments are recorded."
        />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(recent ?? []).map((e) => (
            <li key={e.id} className="flex justify-between px-4 py-3 text-small">
              <span>
                {e.kind} · {e.description || "—"}
              </span>
              <span className="tabular-nums">
                {formatMinorUnits(e.amount_minor, e.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
