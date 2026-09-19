import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { createPolicyVersionAction, updatePolicyVersionStatusAction } from "@/app/admin/operations/actions";

export const metadata: Metadata = { title:"Contract & Policy Versions", robots:{index:false,follow:false} };

export default async function ContractsPage() {
  await RequireAdminPermission("admin:compliance");
  const supabase=await createClient();
  const [{data:versions},{data:acceptances},{data:executions}]=await Promise.all([
    supabase.from("admin_policy_versions").select("*").order("created_at",{ascending:false}).limit(100),
    supabase.from("admin_policy_acceptances").select("policy_version_id,user_id,accepted_at").order("accepted_at",{ascending:false}).limit(300),
    supabase.from("distribution_agreement_executions").select("id,user_id,agreement_version,status,client_signed_at").order("client_signed_at",{ascending:false}).limit(100),
  ]);
  return <div className="space-y-6"><PageHeader title="Contract & Policy Version Management" description="Create, activate and retire policy versions, track re-acceptance requirements and view existing signed distribution-agreement executions."/>
    <details className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"><summary className="cursor-pointer font-semibold">Create policy version</summary><form action={createPolicyVersionAction} className="mt-4 grid gap-3 sm:grid-cols-2"><Input name="policy_key" required placeholder="terms / privacy / distribution_policy"/><Input name="version" required placeholder="v2.0"/><Input name="title" required placeholder="Policy title"/><Input name="effective_at" type="datetime-local"/><label className="flex items-center gap-2 text-small"><input type="checkbox" name="requires_reacceptance"/> Requires re-acceptance</label><Textarea name="body_html" required placeholder="<h1>Policy...</h1>" className="sm:col-span-2 min-h-48 font-mono"/><div><Button type="submit">Create draft</Button></div></form></details>
    <section><h2 className="mb-3 text-h4">Managed policy versions</h2><div className="space-y-3">{(versions??[]).map((row)=>{const count=(acceptances??[]).filter((a)=>a.policy_version_id===row.id).length;return <article key={row.id} className="rounded border border-[var(--nexo-border)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{row.title} · {row.version}</p><p className="text-caption text-[var(--nexo-text-muted)]">{row.policy_key} · {row.status} · {count} acceptance(s){row.requires_reacceptance?" · re-acceptance required":""}</p></div><form action={updatePolicyVersionStatusAction} className="flex gap-2"><input type="hidden" name="id" value={row.id}/><Select name="status" defaultValue={row.status}><option value="draft">draft</option><option value="active">active</option><option value="retired">retired</option></Select><Button size="sm" type="submit">Save</Button></form></div></article>})}</div></section>
    <section><h2 className="mb-3 text-h4">Signed Nexo distribution agreements</h2><p className="text-small text-[var(--nexo-text-muted)]">{(executions??[]).length} recent execution(s) loaded from the existing tamper-evident agreement system.</p></section>
  </div>;
}
