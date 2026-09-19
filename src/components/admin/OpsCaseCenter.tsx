import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import {
  addOpsCaseNoteAction,
  addOpsEvidenceAction,
  uploadOpsEvidenceAction,
  createOpsCaseAction,
  updateOpsCaseAction,
} from "@/app/admin/operations/actions";

type Props = {
  caseType: "rights_claim" | "fraud_review" | "catalog_conflict" | "privacy_request" | "security_review" | "tax_compliance" | "email_deliverability";
  createLabel?: string;
};

export async function OpsCaseCenter({ caseType, createLabel = "Open case" }: Props) {
  const supabase = await createClient();
  const { data: cases, error } = await supabase
    .from("admin_ops_cases")
    .select("id,title,description,status,priority,subject_user_id,release_id,assigned_to,due_at,payout_hold,distribution_hold,source,created_at,updated_at")
    .eq("case_type", caseType)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-danger)]/30 p-4 text-small">
        Could not load cases: {error.message}
      </div>
    );
  }

  const ids = (cases ?? []).map((row) => row.id);
  const [{ data: events }, { data: evidence }] = await Promise.all([
    ids.length
      ? supabase
          .from("admin_ops_case_events")
          .select("id,case_id,event_type,message,actor_user_id,created_at")
          .in("case_id", ids)
          .order("created_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("admin_ops_case_evidence")
          .select("id,case_id,label,evidence_url,storage_path,notes,created_at")
          .in("case_id", ids)
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  const service = createServiceClient();
  const evidenceWithUrls = await Promise.all(
    (evidence ?? []).map(async (item) => {
      if (!item.storage_path) return { ...item, signed_url: null as string | null };
      const { data } = await service.storage
        .from("compliance-evidence")
        .createSignedUrl(item.storage_path, 600);
      return { ...item, signed_url: data?.signedUrl ?? null };
    })
  );

  return (
    <div className="space-y-6">
      <details className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
        <summary className="cursor-pointer text-small font-semibold">{createLabel}</summary>
        <form action={createOpsCaseAction} className="mt-4 grid gap-3 lg:grid-cols-2">
          <input type="hidden" name="case_type" value={caseType} />
          <label className="text-caption">Title<Input name="title" className="mt-1" required /></label>
          <label className="text-caption">Priority<Select name="priority" defaultValue="normal" className="mt-1">
            <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
          </Select></label>
          <label className="text-caption lg:col-span-2">Description<Textarea name="description" className="mt-1" /></label>
          <label className="text-caption">Subject user ID<Input name="subject_user_id" className="mt-1 font-mono" placeholder="Optional UUID" /></label>
          <label className="text-caption">Release ID<Input name="release_id" className="mt-1 font-mono" placeholder="Optional UUID" /></label>
          <label className="text-caption">Assign to staff user ID<Input name="assigned_to" className="mt-1 font-mono" placeholder="Optional UUID" /></label>
          <label className="text-caption">Due at<Input name="due_at" type="datetime-local" className="mt-1" /></label>
          <label className="flex items-center gap-2 text-caption"><input name="payout_hold" type="checkbox" /> Hold payouts while case is open</label>
          <label className="flex items-center gap-2 text-caption"><input name="distribution_hold" type="checkbox" /> Hold distribution while case is open</label>
          <div className="lg:col-span-2"><Button type="submit">{createLabel}</Button></div>
        </form>
      </details>

      {(cases ?? []).length === 0 ? (
        <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-6 text-small text-[var(--nexo-text-muted)]">
          No cases in this queue.
        </div>
      ) : (
        <div className="space-y-4">
          {(cases ?? []).map((row) => {
            const rowEvents = (events ?? []).filter((event) => event.case_id === row.id).slice(0, 5);
            const rowEvidence = evidenceWithUrls.filter((item) => item.case_id === row.id).slice(0, 5);
            return (
              <article key={row.id} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">{row.priority} · {row.status}</p>
                    <h2 className="mt-1 text-h4">{row.title}</h2>
                    {row.description ? <p className="mt-2 whitespace-pre-wrap text-small text-[var(--nexo-text-secondary)]">{row.description}</p> : null}
                    <p className="mt-2 font-mono text-[11px] text-[var(--nexo-text-muted)]">Case {row.id}</p>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                      User {row.subject_user_id ?? "—"} · Release {row.release_id ?? "—"} · Updated {new Date(row.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-caption">
                    {row.payout_hold ? <span className="rounded-full border border-[var(--nexo-warning)]/40 px-2 py-1">Payout hold</span> : null}
                    {row.distribution_hold ? <span className="rounded-full border border-[var(--nexo-warning)]/40 px-2 py-1">Distribution hold</span> : null}
                  </div>
                </div>

                <details className="mt-4 border-t border-[var(--nexo-border)] pt-4">
                  <summary className="cursor-pointer text-small font-medium">Manage case</summary>
                  <form action={updateOpsCaseAction} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="id" value={row.id} />
                    <label className="text-caption">Status<Select name="status" defaultValue={row.status} className="mt-1">
                      {["open","investigating","waiting","action_required","resolved","closed"].map((value) => <option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}
                    </Select></label>
                    <label className="text-caption">Priority<Select name="priority" defaultValue={row.priority} className="mt-1">
                      {["low","normal","high","urgent"].map((value) => <option key={value} value={value}>{value}</option>)}
                    </Select></label>
                    <label className="text-caption">Assigned staff ID<Input name="assigned_to" defaultValue={row.assigned_to ?? ""} className="mt-1 font-mono" /></label>
                    <label className="text-caption">Due at<Input name="due_at" type="datetime-local" defaultValue={row.due_at ? row.due_at.slice(0,16) : ""} className="mt-1" /></label>
                    <label className="flex items-center gap-2 text-caption"><input name="payout_hold" type="checkbox" defaultChecked={row.payout_hold} /> Payout hold</label>
                    <label className="flex items-center gap-2 text-caption"><input name="distribution_hold" type="checkbox" defaultChecked={row.distribution_hold} /> Distribution hold</label>
                    <div className="sm:col-span-2"><Button size="sm" type="submit">Save case</Button></div>
                  </form>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="text-small font-semibold">Timeline</h3>
                      <ul className="mt-2 space-y-2">
                        {rowEvents.map((event) => (
                          <li key={event.id} className="rounded border border-[var(--nexo-border)] p-2 text-caption">
                            <span className="font-medium">{event.event_type.replaceAll("_"," ")}</span> · {event.message}
                            <span className="mt-1 block text-[var(--nexo-text-muted)]">{new Date(event.created_at).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                      <form action={addOpsCaseNoteAction} className="mt-3 space-y-2">
                        <input type="hidden" name="case_id" value={row.id} />
                        <Textarea name="message" required placeholder="Internal case note" />
                        <Button type="submit" size="sm" variant="secondary">Add note</Button>
                      </form>
                    </div>
                    <div>
                      <h3 className="text-small font-semibold">Evidence</h3>
                      <ul className="mt-2 space-y-2">
                        {rowEvidence.map((item) => (
                          <li key={item.id} className="rounded border border-[var(--nexo-border)] p-2 text-caption">
                            <span className="font-medium">{item.label}</span>
                            {item.evidence_url ? <a className="ml-2 underline" href={item.evidence_url} target="_blank" rel="noreferrer">Open link</a> : null}
                            {item.signed_url ? <a className="ml-2 underline" href={item.signed_url} target="_blank" rel="noreferrer">Open file</a> : null}
                            {item.notes ? <span className="mt-1 block text-[var(--nexo-text-muted)]">{item.notes}</span> : null}
                          </li>
                        ))}
                      </ul>
                      <form action={uploadOpsEvidenceAction} className="mt-3 space-y-2">
                        <input type="hidden" name="case_id" value={row.id} />
                        <Input name="label" required placeholder="Evidence label" />
                        <Input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.mp3,.wav,.txt" required />
                        <Textarea name="notes" placeholder="Evidence notes" />
                        <Button type="submit" size="sm" variant="secondary">Upload private evidence</Button>
                      </form>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-caption text-[var(--nexo-text-muted)]">Add external evidence link</summary>
                        <form action={addOpsEvidenceAction} className="mt-2 space-y-2">
                          <input type="hidden" name="case_id" value={row.id} />
                          <Input name="label" required placeholder="Evidence label" />
                          <Input name="evidence_url" type="url" placeholder="https://…" required />
                          <Textarea name="notes" placeholder="Evidence notes / reference" />
                          <Button type="submit" size="sm" variant="secondary">Add evidence link</Button>
                        </form>
                      </details>
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
