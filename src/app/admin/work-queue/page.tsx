import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title:"Operations Work Queue", robots:{index:false,follow:false} };

export default async function WorkQueuePage() {
  await RequireAdminPermission("admin:operations");
  const supabase=await createClient();
  const [ops,qc,dist,verification,support,payout,email] = await Promise.all([
    supabase.from("admin_ops_cases").select("id,case_type,title,status,priority,due_at,updated_at").not("status","in",'("resolved","closed")').order("updated_at",{ascending:false}).limit(80),
    supabase.from("qc_queue_items").select("id,status,priority,release_id,updated_at").in("status",["queued","claimed","in_review"]).order("updated_at",{ascending:false}).limit(20),
    supabase.from("distribution_jobs").select("id,status,release_id,last_error,updated_at").in("status",["queued","failed","takedown_requested","reinstating"]).order("updated_at",{ascending:false}).limit(20),
    supabase.from("identity_verifications").select("id,user_id,status,submitted_at").in("status",["submitted","under_review"]).order("submitted_at",{ascending:false}).limit(20),
    supabase.from("support_tickets").select("id,subject,status,priority,updated_at").in("status",["open","pending","awaiting_user"]).order("updated_at",{ascending:false}).limit(20),
    supabase.from("payout_requests").select("id,owner_user_id,status,amount_minor,currency,updated_at").not("status","in",'("paid","completed","rejected","cancelled","failed")').order("updated_at",{ascending:false}).limit(20),
    supabase.from("email_outbound_events").select("id,to_email,template_key,status,error,updated_at").eq("status","failed").order("updated_at",{ascending:false}).limit(20),
  ]);
  const cards=[
    ["/admin/operations","Operations cases",ops.data?.length??0],
    ["/admin/qc","QC",qc.data?.length??0],
    ["/admin/distribution","Distribution",dist.data?.length??0],
    ["/admin/verifications","Verification",verification.data?.length??0],
    ["/admin/support","Support",support.data?.length??0],
    ["/admin/payouts","Payouts",payout.data?.length??0],
    ["/admin/email-deliverability","Email failures",email.data?.length??0],
  ] as const;
  return <div className="space-y-6">
    <PageHeader title="Operations Work Queue" description="A single realtime attention queue across operations, QC, distribution, verification, support, payouts and email delivery." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([href,label,value])=><Link key={href} href={href} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"><div className="flex items-center justify-between"><span className="font-medium">{label}</span><span className="rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">{value}</span></div></Link>)}</div>
    <section><h2 className="mb-3 text-h4">Priority operations cases</h2><div className="space-y-2">{(ops.data??[]).slice(0,30).map((row)=><div key={row.id} className="rounded border border-[var(--nexo-border)] p-3 text-small"><span className="font-semibold">{row.title}</span><span className="ml-2 text-caption text-[var(--nexo-text-muted)]">{row.case_type.replaceAll("_"," ")} · {row.priority} · {row.status}</span>{row.due_at?<span className="block text-caption text-[var(--nexo-text-muted)]">Due {new Date(row.due_at).toLocaleString()}</span>:null}</div>)}</div></section>
  </div>;
}
