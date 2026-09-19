import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { createHighRiskRequestAction, reviewHighRiskRequestAction } from "@/app/admin/operations/actions";

export const metadata: Metadata = { title:"High-Risk Approvals", robots:{index:false,follow:false} };

export default async function ApprovalsPage() {
  await RequireAdminPermission("admin:operations");
  const supabase=await createClient();
  const {data:rows}=await supabase.from("admin_high_risk_requests").select("*").order("created_at",{ascending:false}).limit(150);
  return <div className="space-y-6">
    <PageHeader title="High-Risk Action Approvals" description="Dual-control records for sensitive actions. The requester cannot approve their own request. Existing workflows are not blocked unless dual approval is explicitly enabled." />
    <details className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"><summary className="cursor-pointer font-semibold">Request approval</summary><form action={createHighRiskRequestAction} className="mt-4 grid gap-3 sm:grid-cols-2"><Input name="action_type" required placeholder="e.g. mass_takedown"/><Input name="target_type" placeholder="release / user / payout / policy"/><Input name="target_id" placeholder="Target ID"/><Textarea name="payload" placeholder='Optional JSON: {"amount":100}'/><Textarea name="reason" required placeholder="Why this action is required" className="sm:col-span-2"/><div><Button type="submit">Create request</Button></div></form></details>
    <div className="space-y-3">{(rows??[]).map((row)=><article key={row.id} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"><p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">{row.status} · {row.action_type}</p><h2 className="mt-1 font-semibold">{row.target_type??"target"} {row.target_id??"—"}</h2><p className="mt-2 text-small">{row.reason}</p><p className="mt-2 font-mono text-caption text-[var(--nexo-text-muted)]">Requested by {row.requested_by}</p>{row.status==="pending"?<div className="mt-3 flex flex-wrap gap-2"><form action={reviewHighRiskRequestAction}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="status" value="approved"/><Button size="sm" type="submit">Approve</Button></form><form action={reviewHighRiskRequestAction}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="status" value="rejected"/><Button size="sm" type="submit" variant="outline">Reject</Button></form></div>:null}</article>)}</div>
  </div>;
}
