import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { OpsCaseCenter } from "@/components/admin/OpsCaseCenter";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  executeOwnershipReassignmentAction,
  openConflictCaseAction,
  refreshCatalogConflictsAction,
  requestOwnershipReassignmentAction,
  updateCatalogConflictAction,
} from "@/app/admin/operations/actions";

export const metadata: Metadata = {
  title: "Catalog Conflicts",
  robots: { index: false, follow: false },
};

export default async function ConflictsPage() {
  await RequireAdminPermission("admin:compliance");
  const supabase = await createClient();
  const [{ data: candidates }, { data: approvedRequests }] = await Promise.all([
    supabase
      .from("catalog_conflict_candidates")
      .select("id,conflict_type,identifier,release_ids,track_ids,owner_user_ids,status,linked_case_id,resolution_note,last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(150),
    supabase
      .from("admin_high_risk_requests")
      .select("id,target_id,payload,reason,requested_by,reviewed_by,reviewed_at,status")
      .eq("action_type", "release_ownership_reassignment")
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalog Conflict Center"
        description="Detect cross-owner ISRC/UPC conflicts, gather evidence and resolve ownership only through a second-admin approved workflow."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
        <div>
          <h2 className="font-semibold">Identifier conflict scan</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Detects the same ISRC or UPC attached to different Nexo account owners. Detection never changes ownership automatically.
          </p>
        </div>
        <form action={refreshCatalogConflictsAction}>
          <Button type="submit">Scan catalog conflicts</Button>
        </form>
      </div>

      <section className="space-y-3">
        {(candidates ?? []).length === 0 ? (
          <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-5 text-small text-[var(--nexo-text-muted)]">
            No cross-owner identifier conflicts are currently recorded.
          </div>
        ) : (
          (candidates ?? []).map((row) => (
            <article
              key={row.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"
            >
              <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
                {row.conflict_type.replaceAll("_", " ")} · {row.status}
              </p>
              <h3 className="mt-1 text-h4">{row.identifier}</h3>
              <div className="mt-3 grid gap-2 text-caption text-[var(--nexo-text-muted)]">
                <p>Release IDs: {(row.release_ids ?? []).join(", ") || "—"}</p>
                <p>Track IDs: {(row.track_ids ?? []).join(", ") || "—"}</p>
                <p>Owner IDs: {(row.owner_user_ids ?? []).join(", ") || "—"}</p>
                <p>Linked case: {row.linked_case_id ?? "—"}</p>
                <p>Last seen: {new Date(row.last_seen_at).toLocaleString()}</p>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <form action={updateCatalogConflictAction} className="space-y-2 rounded border border-[var(--nexo-border)] p-3">
                  <input type="hidden" name="id" value={row.id} />
                  <Select name="status" defaultValue={row.status}>
                    <option value="open">Open</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="evidence_requested">Evidence requested</option>
                    <option value="no_conflict">No conflict</option>
                    <option value="resolved">Resolved</option>
                  </Select>
                  <Textarea
                    name="resolution_note"
                    defaultValue={row.resolution_note ?? ""}
                    placeholder="Review / resolution note"
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Save review state
                  </Button>
                </form>

                <div className="space-y-3 rounded border border-[var(--nexo-border)] p-3">
                  {!row.linked_case_id ? (
                    <form action={openConflictCaseAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button type="submit" size="sm">
                        Open evidence case
                      </Button>
                    </form>
                  ) : null}

                  <details>
                    <summary className="cursor-pointer text-small font-medium">
                      Request ownership reassignment
                    </summary>
                    <form action={requestOwnershipReassignmentAction} className="mt-3 space-y-2">
                      <input type="hidden" name="candidate_id" value={row.id} />
                      <Input name="release_id" required placeholder="Release UUID to reassign" />
                      <Input name="target_owner_user_id" required placeholder="Target artist/label user UUID" />
                      <Textarea
                        name="reason"
                        required
                        placeholder="Evidence-based reason for ownership reassignment"
                      />
                      <Button type="submit" size="sm">
                        Send for second-admin approval
                      </Button>
                    </form>
                  </details>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {(approvedRequests ?? []).length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-h4">Approved ownership changes awaiting execution</h2>
          {(approvedRequests ?? []).map((req) => (
            <div
              key={req.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
            >
              <div>
                <p className="font-semibold">Release {req.target_id ?? "—"}</p>
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{req.reason}</p>
                <pre className="mt-2 max-w-2xl overflow-auto rounded bg-[var(--nexo-elevated)] p-2 text-[11px]">
                  {JSON.stringify(req.payload ?? {}, null, 2)}
                </pre>
              </div>
              <form action={executeOwnershipReassignmentAction}>
                <input type="hidden" name="request_id" value={req.id} />
                <Button type="submit">Execute approved reassignment</Button>
              </form>
            </div>
          ))}
        </section>
      ) : null}

      <OpsCaseCenter caseType="catalog_conflict" createLabel="Open catalog conflict" />
    </div>
  );
}
