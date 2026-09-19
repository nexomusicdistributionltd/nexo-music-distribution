import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title:"Audit Intelligence", robots:{index:false,follow:false} };

export default async function AuditIntelligencePage({searchParams}:{searchParams:Promise<{actor?:string;entity?:string;action?:string;q?:string}>}) {
  await RequireAdminPermission("admin:audit");
  const sp=await searchParams;
  const supabase=await createClient();
  let query=supabase.from("audit_logs").select("id,actor_user_id,action,entity_type,entity_id,metadata,ip_address,user_agent,created_at").order("created_at",{ascending:false}).limit(250);
  if(sp.actor) query=query.eq("actor_user_id",sp.actor);
  if(sp.entity) query=query.eq("entity_type",sp.entity);
  if(sp.action) query=query.eq("action",sp.action);
  const {data:rows,error}=await query;
  const needle=(sp.q??"").trim().toLowerCase();
  const filtered=(rows??[]).filter((row)=>!needle || JSON.stringify(row).toLowerCase().includes(needle));
  return <div className="space-y-6">
    <PageHeader title="Audit Intelligence" description="Search immutable operational audit events by actor, entity, action, IP, user agent and metadata." />
    <form method="get" className="grid gap-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 sm:grid-cols-2 xl:grid-cols-4">
      <input name="actor" defaultValue={sp.actor??""} placeholder="Actor UUID" className="h-10 rounded-[var(--nexo-radius)] border border-[var(--nexo-input-border)] bg-[var(--nexo-input-bg)] px-3 text-small"/>
      <input name="entity" defaultValue={sp.entity??""} placeholder="Entity type" className="h-10 rounded-[var(--nexo-radius)] border border-[var(--nexo-input-border)] bg-[var(--nexo-input-bg)] px-3 text-small"/>
      <input name="action" defaultValue={sp.action??""} placeholder="Exact action" className="h-10 rounded-[var(--nexo-radius)] border border-[var(--nexo-input-border)] bg-[var(--nexo-input-bg)] px-3 text-small"/>
      <input name="q" defaultValue={sp.q??""} placeholder="Search loaded metadata" className="h-10 rounded-[var(--nexo-radius)] border border-[var(--nexo-input-border)] bg-[var(--nexo-input-bg)] px-3 text-small"/>
      <button className="rounded-full border border-[var(--nexo-border)] px-4 py-2 text-small" type="submit">Filter</button>
    </form>
    {error?<p className="text-small text-red-600">{error.message}</p>:null}
    <div className="space-y-2">{filtered.map((row)=><details key={row.id} className="rounded border border-[var(--nexo-border)] p-3 text-small"><summary className="cursor-pointer"><span className="font-semibold">{row.action}</span> · {row.entity_type} · {new Date(row.created_at).toLocaleString()}</summary><div className="mt-3 grid gap-2 text-caption text-[var(--nexo-text-muted)]"><p>Actor: <span className="font-mono">{row.actor_user_id??"system"}</span></p><p>Entity: <span className="font-mono">{row.entity_id??"—"}</span></p><p>IP: {row.ip_address??"—"}</p><p>User agent: {row.user_agent??"—"}</p><pre className="overflow-x-auto rounded bg-[var(--nexo-elevated)] p-3">{JSON.stringify(row.metadata??{},null,2)}</pre></div></details>)}</div>
  </div>;
}
