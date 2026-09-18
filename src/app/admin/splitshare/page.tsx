import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { SplitShareRealtime } from "@/components/portal/SplitShareRealtime";
import { SplitShareReviewControls } from "@/components/admin/SplitShareReviewControls";
import { formatMinorUnits } from "@/lib/finance/money";

export const metadata: Metadata = {
  title: "SplitShare",
  robots: { index: false, follow: false },
};

type ProfileLabel = { id: string; email: string; full_name: string | null };

export default async function AdminSplitSharePage() {
  await RequireAdminPermission("admin:splitshare");
  const supabase = await createClient();

  const [
    { data: payees },
    { data: rules },
    { data: assignments },
    { data: recoupments },
    { data: allocations },
  ] = await Promise.all([
    supabase
      .from("portal_payees")
      .select("id, owner_user_id, name, email, role_label, status, admin_note, linked_user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("royalty_split_rules")
      .select("id, owner_user_id, name, effective_from, effective_to, review_status, is_active, admin_note, royalty_split_shares(party_name, share_bps)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("split_track_assignments")
      .select("id, owner_user_id, track_id, split_rule_id, status, admin_note, created_at, release_tracks(title), royalty_split_rules(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("portal_recoupments")
      .select("id, owner_user_id, payee_id, track_id, title, amount_minor, recovered_minor, currency, status, admin_note, created_at, portal_payees(name,email), release_tracks(title)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("splitshare_allocations")
      .select("id, owner_user_id, payee_id, track_id, currency, gross_share_minor, recouped_minor, payable_minor, status, created_at, portal_payees(name,email), release_tracks(title)")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const ownerIds = [
    ...new Set(
      [
        ...(payees ?? []).map((row) => row.owner_user_id),
        ...(rules ?? []).map((row) => row.owner_user_id),
        ...(assignments ?? []).map((row) => row.owner_user_id),
        ...(recoupments ?? []).map((row) => row.owner_user_id),
      ].filter(Boolean)
    ),
  ];

  const { data: profiles } = ownerIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ownerIds)
    : { data: [] as ProfileLabel[] };

  const owners = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.full_name?.trim() ? `${profile.full_name} · ${profile.email}` : profile.email,
    ])
  );

  const empty =
    (payees ?? []).length === 0 &&
    (rules ?? []).length === 0 &&
    (assignments ?? []).length === 0 &&
    (recoupments ?? []).length === 0 &&
    (allocations ?? []).length === 0;

  return (
    <div className="space-y-8">
      <SplitShareRealtime />
      <PageIntro
        title="SplitShare"
        description="Realtime control center for payees, royalty splits, track assignments, recoupments, and posted allocation results."
      />

      {empty ? <EmptyState title="No SplitShare activity yet" /> : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-h4">Payees</h2>
          <p className="text-caption text-[var(--nexo-text-muted)]">
            Approve the recipient identity/email before it can be used in a new split.
          </p>
        </div>
        {(payees ?? []).length === 0 ? (
          <EmptyState title="No payees" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(payees ?? []).map((payee) => (
              <article
                key={payee.id}
                className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4 text-small"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{payee.name}</strong>
                  <span className="text-caption uppercase text-[var(--nexo-text-muted)]">{payee.status}</span>
                </div>
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                  {payee.email} · {payee.role_label}
                </p>
                <p className="mt-1 text-caption">
                  Owner: {owners.get(payee.owner_user_id) ?? payee.owner_user_id}
                </p>
                <p className="mt-1 text-caption">
                  {payee.linked_user_id ? "Linked Nexo payee account" : "External payee — future payable is held until linked"}
                </p>
                {payee.admin_note ? <p className="mt-2 text-caption">Last note: {payee.admin_note}</p> : null}
                <SplitShareReviewControls kind="payee" id={payee.id} status={payee.status} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-h4">Splits</h2>
          <p className="text-caption text-[var(--nexo-text-muted)]">
            Approval activates a 100% payee split. Rejection leaves it inactive.
          </p>
        </div>
        {(rules ?? []).length === 0 ? (
          <EmptyState title="No split rules" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(rules ?? []).map((rule) => (
              <article
                key={rule.id}
                className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4 text-small"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{rule.name}</strong>
                  <span className="text-caption uppercase text-[var(--nexo-text-muted)]">{rule.review_status}</span>
                </div>
                <p className="mt-1 text-caption">Owner: {owners.get(rule.owner_user_id) ?? rule.owner_user_id}</p>
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                  Effective {rule.effective_from} → {rule.effective_to || "open"} · {rule.is_active ? "active" : "inactive"}
                </p>
                <ul className="mt-2 text-caption">
                  {(rule.royalty_split_shares as { party_name: string; share_bps: number }[] | null)?.map(
                    (share, index) => (
                      <li key={index}>
                        {share.party_name}: {(share.share_bps / 100).toFixed(2)}%
                      </li>
                    )
                  )}
                </ul>
                {rule.admin_note ? <p className="mt-2 text-caption">Last note: {rule.admin_note}</p> : null}
                <SplitShareReviewControls kind="split" id={rule.id} status={rule.review_status} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-h4">Track assignments</h2>
          <p className="text-caption text-[var(--nexo-text-muted)]">
            Only approved assignments are considered when a real royalty row is posted.
          </p>
        </div>
        {(assignments ?? []).length === 0 ? (
          <EmptyState title="No assignments" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(assignments ?? []).map((assignment) => {
              const track = assignment.release_tracks as { title?: string | null } | null;
              const rule = assignment.royalty_split_rules as { name?: string | null } | null;
              return (
                <article
                  key={assignment.id}
                  className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4 text-small"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{track?.title || "Untitled track"}</strong>
                    <span className="text-caption uppercase text-[var(--nexo-text-muted)]">{assignment.status}</span>
                  </div>
                  <p className="mt-1 text-caption">Split: {rule?.name || assignment.split_rule_id}</p>
                  <p className="mt-1 text-caption">Owner: {owners.get(assignment.owner_user_id) ?? assignment.owner_user_id}</p>
                  {assignment.admin_note ? <p className="mt-2 text-caption">Last note: {assignment.admin_note}</p> : null}
                  <SplitShareReviewControls kind="assignment" id={assignment.id} status={assignment.status} />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-h4">Recoupments</h2>
          <p className="text-caption text-[var(--nexo-text-muted)]">
            Approved balances recover from that payee’s future SplitShare allocation before a payable credit is created.
          </p>
        </div>
        {(recoupments ?? []).length === 0 ? (
          <EmptyState title="No recoupments" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(recoupments ?? []).map((recoupment) => {
              const payee = recoupment.portal_payees as { name?: string | null; email?: string | null } | null;
              const track = recoupment.release_tracks as { title?: string | null } | null;
              return (
                <article
                  key={recoupment.id}
                  className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4 text-small"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{recoupment.title}</strong>
                    <span className="text-caption uppercase text-[var(--nexo-text-muted)]">{recoupment.status}</span>
                  </div>
                  <p className="mt-1 text-caption">
                    {formatMinorUnits(Number(recoupment.recovered_minor ?? 0), recoupment.currency)} recovered of{" "}
                    {formatMinorUnits(Number(recoupment.amount_minor), recoupment.currency)}
                  </p>
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                    Payee: {payee?.name || recoupment.payee_id}
                    {payee?.email ? ` · ${payee.email}` : ""}
                  </p>
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                    Scope: {recoupment.track_id ? track?.title || recoupment.track_id : "All assigned tracks"}
                  </p>
                  <p className="mt-1 text-caption">Owner: {owners.get(recoupment.owner_user_id) ?? recoupment.owner_user_id}</p>
                  {recoupment.admin_note ? <p className="mt-2 text-caption">Last note: {recoupment.admin_note}</p> : null}
                  <SplitShareReviewControls kind="recoupment" id={recoupment.id} status={recoupment.status} />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-h4">Posted allocations</h2>
          <p className="text-caption text-[var(--nexo-text-muted)]">
            These rows are created only from posted royalty ledger entries; no estimated or demo earnings are shown here.
          </p>
        </div>
        {(allocations ?? []).length === 0 ? (
          <EmptyState title="No posted SplitShare allocations yet" />
        ) : (
          <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            <table className="min-w-full text-left text-small">
              <thead className="bg-[var(--nexo-card)] text-caption text-[var(--nexo-text-muted)]">
                <tr>
                  <th className="px-3 py-2">Payee</th>
                  <th className="px-3 py-2">Track</th>
                  <th className="px-3 py-2">Gross share</th>
                  <th className="px-3 py-2">Recouped</th>
                  <th className="px-3 py-2">Payable</th>
                  <th className="px-3 py-2">State</th>
                </tr>
              </thead>
              <tbody>
                {(allocations ?? []).map((allocation) => {
                  const payee = allocation.portal_payees as { name?: string | null; email?: string | null } | null;
                  const track = allocation.release_tracks as { title?: string | null } | null;
                  return (
                    <tr key={allocation.id} className="border-t border-[var(--nexo-divider)]">
                      <td className="px-3 py-2">{payee?.name || allocation.payee_id || "Owner"}</td>
                      <td className="px-3 py-2">{track?.title || "—"}</td>
                      <td className="px-3 py-2">{formatMinorUnits(Number(allocation.gross_share_minor), allocation.currency)}</td>
                      <td className="px-3 py-2">{formatMinorUnits(Number(allocation.recouped_minor), allocation.currency)}</td>
                      <td className="px-3 py-2">{formatMinorUnits(Number(allocation.payable_minor), allocation.currency)}</td>
                      <td className="px-3 py-2 uppercase">{allocation.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
