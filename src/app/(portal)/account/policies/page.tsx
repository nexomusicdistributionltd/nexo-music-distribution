import type { Metadata } from "next";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SafeHtml } from "@/components/cms/SafeHtml";
import { Button } from "@/components/ui/Button";
import { acceptPolicyVersionAction } from "./actions";

export const metadata: Metadata={title:"Policies & Agreements",robots:{index:false,follow:false}};

export default async function PoliciesPage(){
  const ctx=await RequireVerifiedPortal();
  const supabase=await createClient();
  const [{data:versions},{data:acceptances}]=await Promise.all([
    supabase.from("admin_policy_versions").select("id,policy_key,version,title,body_html,effective_at,requires_reacceptance").eq("status","active").order("effective_at",{ascending:false,nullsFirst:false}),
    supabase.from("admin_policy_acceptances").select("policy_version_id,accepted_at").eq("user_id",ctx.userId),
  ]);
  const accepted=new Map((acceptances??[]).map((row)=>[row.policy_version_id,row.accepted_at]));
  return <main className="space-y-6">
    <section className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8">
      <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">Account</p>
      <h1 className="mt-2 text-3xl font-semibold">Policies & agreements</h1>
      <p className="mt-2 max-w-2xl text-small text-[var(--nexo-text-secondary)]">Review active Nexo policy versions and record required re-acceptance. Your existing signed distribution-agreement execution remains separate and unchanged.</p>
    </section>
    {(versions??[]).length===0?<p className="rounded border border-[var(--nexo-border)] p-5 text-small">No additional active policy versions require review.</p>:null}
    {(versions??[]).map((row)=>{const at=accepted.get(row.id);return <article key={row.id} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">{row.policy_key} · {row.version}</p><h2 className="mt-1 text-h4">{row.title}</h2></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${at?"bg-emerald-600 text-white":row.requires_reacceptance?"bg-red-600 text-white":"border border-[var(--nexo-border)]"}`}>{at?"Accepted":row.requires_reacceptance?"Acceptance required":"Review"}</span></div>
      <SafeHtml html={row.body_html} className="nexo-blog-article mt-5"/>
      <div className="mt-5 border-t border-[var(--nexo-border)] pt-4">{at?<p className="text-caption text-[var(--nexo-text-muted)]">Accepted {new Date(at).toLocaleString()}</p>:<form action={acceptPolicyVersionAction}><input type="hidden" name="policy_version_id" value={row.id}/><Button type="submit">Accept this version</Button></form>}</div>
    </article>})}
  </main>;
}
