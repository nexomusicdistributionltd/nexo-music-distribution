import type { Metadata } from "next";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { EarningsNav } from "@/components/finance/EarningsNav";
import { SplitRuleForm } from "@/components/portal/PortalForms";

export const metadata: Metadata = {
  title: "Splits",
  robots: { index: false, follow: false },
};

export default async function EarningsSplitsPage() {
  const user = await RequireVerifiedEmail();
  const supabase = await createClient();
  const { data } = await supabase
    .from("royalty_split_rules")
    .select("id, name, scope_type, effective_from, effective_to, is_active, royalty_split_shares(party_name, party_role, share_bps)")
    .eq("owner_user_id", user.userId)
    .order("effective_from", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-h2">Split rules</h1>
      <EarningsNav />
      <SplitRuleForm />
      {(data ?? []).length === 0 ? (
        <EmptyState
          title="No split rules"
          description="Create a split to share royalties with collaborators or payees."
        />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((r) => (
            <li
              key={r.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-small"
            >
              <p className="font-medium">
                {r.name} · {r.scope_type} {r.is_active ? "" : "(inactive)"}
              </p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {r.effective_from} → {r.effective_to || "open"}
              </p>
              <ul className="mt-2 text-caption">
                {(r.royalty_split_shares as { party_name: string; party_role: string; share_bps: number }[] | null)?.map(
                  (s, i) => (
                    <li key={i}>
                      {s.party_name} ({s.party_role}): {(s.share_bps / 100).toFixed(2)}%
                    </li>
                  )
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
