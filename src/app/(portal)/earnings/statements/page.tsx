import type { Metadata } from "next";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMinorUnits } from "@/lib/finance/money";
import { EarningsNav } from "@/components/finance/EarningsNav";

export const metadata: Metadata = {
  title: "Statements",
  robots: { index: false, follow: false },
};

export default async function EarningsStatementsPage() {
  const user = await RequireVerifiedEmail();
  const supabase = await createClient();
  const { data } = await supabase
    .from("royalty_statements")
    .select("*")
    .eq("owner_user_id", user.userId)
    .eq("status", "published")
    .order("period_end", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <h1 className="text-h2">Statements</h1>
      <EarningsNav />
      {(data ?? []).length === 0 ? (
        <EmptyState
          title="No statements yet"
          description="Your royalty statements will appear here when available."
        />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(data ?? []).map((s) => (
            <li key={s.id} className="flex justify-between px-4 py-3 text-small">
              <span>
                {s.period_start} → {s.period_end}
              </span>
              <span className="tabular-nums">
                {formatMinorUnits(s.closing_minor ?? s.total_minor, s.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
