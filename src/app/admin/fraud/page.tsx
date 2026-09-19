import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { OpsCaseCenter } from "@/components/admin/OpsCaseCenter";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  openFraudCaseFromSignalAction,
  refreshRiskSignalsAction,
  updateRiskSignalAction,
} from "@/app/admin/operations/actions";

export const metadata: Metadata = {
  title: "Fraud & Streaming Risk",
  robots: { index: false, follow: false },
};

export default async function FraudPage() {
  await RequireAdminPermission("admin:compliance");
  const supabase = await createClient();
  const { data: signals } = await supabase
    .from("admin_risk_signals")
    .select("id,signal_type,severity,subject_user_id,release_id,status,summary,evidence,detected_at,last_seen_at")
    .order("last_seen_at", { ascending: false })
    .limit(150);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fraud & Streaming Risk"
        description="Objective risk signals and staff investigations. Signals are review indicators, not automatic fraud findings, and they never alter royalties or catalog ownership by themselves."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
        <div>
          <h2 className="font-semibold">Risk signal engine</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Checks cross-owner ISRC/UPC reuse, payout-request velocity, repeated delivery failures and high-severity identity-verification signals.
          </p>
        </div>
        <form action={refreshRiskSignalsAction}>
          <Button type="submit">Refresh objective signals</Button>
        </form>
      </div>

      <section className="space-y-3">
        {(signals ?? []).length === 0 ? (
          <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-5 text-small text-[var(--nexo-text-muted)]">
            No risk signals are currently recorded.
          </div>
        ) : (
          (signals ?? []).map((signal) => (
            <article
              key={signal.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
                    {signal.severity} · {signal.signal_type.replaceAll("_", " ")} · {signal.status}
                  </p>
                  <h3 className="mt-1 font-semibold">{signal.summary}</h3>
                  <p className="mt-2 font-mono text-[11px] text-[var(--nexo-text-muted)]">
                    User {signal.subject_user_id ?? "—"} · Release {signal.release_id ?? "—"}
                  </p>
                  <pre className="mt-3 max-h-48 overflow-auto rounded bg-[var(--nexo-elevated)] p-3 text-[11px]">
                    {JSON.stringify(signal.evidence ?? {}, null, 2)}
                  </pre>
                  <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                    Last seen {new Date(signal.last_seen_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={updateRiskSignalAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={signal.id} />
                    <Select name="status" defaultValue={signal.status}>
                      <option value="open">Open</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="dismissed">Dismissed</option>
                      <option value="resolved">Resolved</option>
                    </Select>
                    <Button type="submit" size="sm" variant="outline">
                      Save
                    </Button>
                  </form>
                  <form action={openFraudCaseFromSignalAction}>
                    <input type="hidden" name="id" value={signal.id} />
                    <Button type="submit" size="sm">
                      Open investigation
                    </Button>
                  </form>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <OpsCaseCenter caseType="fraud_review" createLabel="Open fraud review" />
    </div>
  );
}
