import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { OpsCaseCenter } from "@/components/admin/OpsCaseCenter";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { addEmailSuppressionAction, removeEmailSuppressionAction } from "@/app/admin/operations/actions";

export const metadata: Metadata = { title:"Email Deliverability", robots:{index:false,follow:false} };

export default async function EmailDeliverabilityPage() {
  await RequireAdminPermission("admin:emails");
  const supabase=await createClient();
  const [{data:events},{data:suppressions}]=await Promise.all([
    supabase.from("email_outbound_events").select("id,to_email,template_key,status,provider,provider_message_id,error,created_at,updated_at").order("created_at",{ascending:false}).limit(150),
    supabase.from("email_suppressions").select("*").order("updated_at",{ascending:false}).limit(100),
  ]);
  const failed=(events??[]).filter((row)=>row.status==="failed").length;
  const sent=(events??[]).filter((row)=>row.status==="sent").length;
  return <div className="space-y-6">
    <PageHeader title="Email Deliverability" description="Outbound delivery, provider failures and suppression controls. Suppression affects only addresses explicitly marked active." />
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Sent (recent)" value={sent}/><Metric label="Failed (recent)" value={failed}/><Metric label="Active suppressions" value={(suppressions??[]).filter((row)=>row.active).length}/></div>
    <form action={addEmailSuppressionAction} className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 sm:grid-cols-[1fr_1fr_auto]">
      <Input name="email" type="email" required placeholder="email@example.com" />
      <Input name="reason" required placeholder="Bounce / complaint / manual suppression reason" />
      <Button type="submit">Suppress</Button>
    </form>
    <section><h2 className="mb-3 text-h4">Suppressions</h2><div className="space-y-2">{(suppressions??[]).map((row)=><div key={row.email} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--nexo-border)] p-3 text-small"><div><span className="font-medium">{row.email}</span><span className="ml-2 text-caption text-[var(--nexo-text-muted)]">{row.active?"active":"inactive"} · {row.reason}</span></div>{row.active?<form action={removeEmailSuppressionAction}><input type="hidden" name="email" value={row.email}/><Button type="submit" size="sm" variant="secondary">Remove suppression</Button></form>:null}</div>)}</div></section>
    <section><h2 className="mb-3 text-h4">Recent outbound events</h2><div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]"><table className="min-w-full text-left text-small"><thead><tr className="border-b border-[var(--nexo-border)]"><th className="p-3">Recipient</th><th className="p-3">Template</th><th className="p-3">Status</th><th className="p-3">Provider</th><th className="p-3">Error</th></tr></thead><tbody>{(events??[]).map((row)=><tr key={row.id} className="border-b border-[var(--nexo-divider)]"><td className="p-3">{row.to_email}</td><td className="p-3">{row.template_key}</td><td className="p-3">{row.status}</td><td className="p-3">{row.provider??"—"}</td><td className="max-w-xl p-3 text-caption text-[var(--nexo-text-muted)]">{row.error??"—"}</td></tr>)}</tbody></table></div></section>
    <OpsCaseCenter caseType="email_deliverability" createLabel="Open deliverability case" />
  </div>;
}
function Metric({label,value}:{label:string;value:number}) { return <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"><p className="text-caption text-[var(--nexo-text-muted)]">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
