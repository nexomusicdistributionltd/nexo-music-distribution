import type { Metadata } from "next";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { EarningsNav } from "@/components/finance/EarningsNav";
import { SplitRuleForm } from "@/components/portal/PortalForms";
import { SplitShareRealtime } from "@/components/portal/SplitShareRealtime";

export const metadata: Metadata = {
  title: "Splits",
  robots: { index: false, follow: false },
};

export default async function EarningsSplitsPage() {
  const user = await RequireVerifiedEmail();
  const supabase = await createClient();
  const [{ data }, { data: payees }] = await Promise.all([
    supabase
      .from("royalty_split_rules")
      .select("id, name, scope_type, effective_from, effective_to, is_active, review_status, admin_note, royalty_split_shares(party_name, party_role, share_bps, payee_id)")
      .eq("owner_user_id", user.userId)
      .order("effective_from", { ascending: false }),
    supabase
      .from("portal_payees")
      .select("id, name, email, role_label")
      .eq("owner_user_id", user.userId)
      .eq("status", "approved")
      .order("name"),
  ]);

  return (
    <div className="space-y-4">
      <SplitShareRealtime ownerUserId={user.userId} />
      <h1 className="text-h2">Split rules</h1>
      <EarningsNav />
      <SplitRuleForm
        payees={(payees ?? []).map((payee) => ({
          id: payee.id,
          name: payee.name,
          email: payee.email,
          roleLabel: payee.role_label as "artist" | "label" | "producer" | "songwriter" | "featured" | "publisher" | "other",
        }))}
      />
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
                {r.effective_from} → {r.effective_to || "open"} · {r.review_status}
              </p>
              {r.admin_note ? (
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">Admin: {r.admin_note}</p>
              ) : null}
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
