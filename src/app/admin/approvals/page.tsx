import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import {
  createHighRiskRequestAction,
  executeApprovedAccountStatusAction,
  executeBulkTakedownApprovalAction,
  executeOwnershipReassignmentAction,
  requestBulkTakedownApprovalAction,
  reviewHighRiskRequestAction,
} from "@/app/admin/operations/actions";

export const metadata: Metadata = {
  title: "High-Risk Approvals",
  robots: { index: false, follow: false },
};

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    royalty_commission_change: "Royalty commission change",
    release_ownership_reassignment: "Release ownership reassignment",
    bulk_release_takedown: "Bulk release takedown",
    account_status_destructive: "Account suspension / deactivation",
  };
  return labels[action] ?? action.replaceAll("_", " ");
}

export default async function ApprovalsPage() {
  await RequireAdminPermission("admin:operations");
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("admin_high_risk_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const pending = (rows ?? []).filter((row) => row.status === "pending");
  const approved = (rows ?? []).filter((row) => row.status === "approved");

  return (
    <div className="space-y-7">
      <PageHeader
        title="High-Risk Action Approvals"
        description="Second-admin control for sensitive platform changes. A requester cannot approve their own request, and approved actions remain explicit until execution."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Pending review" value={pending.length} />
        <Metric label="Approved, awaiting execution" value={approved.length} />
        <Metric
          label="Executed / closed"
          value={(rows ?? []).filter((row) => ["executed", "rejected", "cancelled"].includes(row.status)).length}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <details className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
          <summary className="cursor-pointer font-semibold">Request bulk release takedown</summary>
          <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
            Up to 100 release UUIDs. Nothing is changed until another authorized administrator approves the request and the approved request is explicitly executed.
          </p>
          <form action={requestBulkTakedownApprovalAction} className="mt-4 space-y-3">
            <Textarea
              name="release_ids"
              required
              placeholder="Release UUIDs separated by commas, spaces or new lines"
              className="min-h-28 font-mono text-caption"
            />
            <Textarea name="reason" required placeholder="Required takedown reason" />
            <Button type="submit">Send for second-admin approval</Button>
          </form>
        </details>

        <details className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
          <summary className="cursor-pointer font-semibold">Create another controlled action</summary>
          <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
            Use documented action types only. Operational execution remains separate from approval.
          </p>
          <form action={createHighRiskRequestAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input name="action_type" required placeholder="Documented action type" />
            <Input name="target_type" placeholder="release / profile / policy / batch" />
            <Input name="target_id" placeholder="Target ID" />
            <Textarea name="payload" placeholder='Optional JSON payload' />
            <Textarea
              name="reason"
              required
              placeholder="Why this sensitive action is required"
              className="sm:col-span-2"
            />
            <div>
              <Button type="submit">Create approval request</Button>
            </div>
          </form>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-h4">Approval queue</h2>
        {(rows ?? []).length === 0 ? (
          <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-5 text-small text-[var(--nexo-text-muted)]">
            No high-risk approval records yet.
          </div>
        ) : (
          (rows ?? []).map((row) => (
            <article
              key={row.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
                    {row.status} · {actionLabel(row.action_type)}
                  </p>
                  <h3 className="mt-1 font-semibold">
                    {row.target_type ?? "target"} {row.target_id ?? "—"}
                  </h3>
                  <p className="mt-2 text-small">{row.reason}</p>
                  <p className="mt-2 font-mono text-[11px] text-[var(--nexo-text-muted)]">
                    Requested by {row.requested_by}
                    {row.reviewed_by ? ` · Reviewed by ${row.reviewed_by}` : ""}
                  </p>
                  <pre className="mt-3 max-h-48 max-w-3xl overflow-auto rounded bg-[var(--nexo-elevated)] p-3 text-[11px]">
                    {JSON.stringify(row.payload ?? {}, null, 2)}
                  </pre>
                  {row.execution_note ? (
                    <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                      {row.execution_note}
                    </p>
                  ) : null}
                </div>

                <div className="flex max-w-sm flex-wrap gap-2">
                  {row.status === "pending" ? (
                    <>
                      <form action={reviewHighRiskRequestAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="status" value="approved" />
                        <Button size="sm" type="submit">
                          Approve
                        </Button>
                      </form>
                      <form action={reviewHighRiskRequestAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <Button size="sm" type="submit" variant="outline">
                          Reject
                        </Button>
                      </form>
                    </>
                  ) : null}

                  {row.status === "approved" && row.action_type === "bulk_release_takedown" ? (
                    <form action={executeBulkTakedownApprovalAction}>
                      <input type="hidden" name="request_id" value={row.id} />
                      <Button size="sm" type="submit">
                        Execute approved takedown batch
                      </Button>
                    </form>
                  ) : null}

                  {row.status === "approved" && row.action_type === "release_ownership_reassignment" ? (
                    <form action={executeOwnershipReassignmentAction}>
                      <input type="hidden" name="request_id" value={row.id} />
                      <Button size="sm" type="submit">
                        Execute approved ownership change
                      </Button>
                    </form>
                  ) : null}

                  {row.status === "approved" && row.action_type === "account_status_destructive" ? (
                    <form action={executeApprovedAccountStatusAction}>
                      <input type="hidden" name="request_id" value={row.id} />
                      <Button size="sm" type="submit">
                        Execute approved account action
                      </Button>
                    </form>
                  ) : null}

                  {row.status === "approved" && row.action_type === "royalty_commission_change" ? (
                    <p className="text-caption text-[var(--nexo-text-muted)]">
                      Re-submit the same percentages from Admin → Royalties to execute the approved policy change.
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
      <p className="text-caption text-[var(--nexo-text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
