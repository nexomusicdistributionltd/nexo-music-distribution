import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getProviderConnectionState } from "@/lib/provider";
import { getPaymentConnectionState } from "@/lib/finance/payment";
import { ddexConfigPublicStatus } from "@/lib/ddex/config";

export const metadata: Metadata = { title:"System Health", robots:{index:false,follow:false} };

export default async function SystemHealthPage() {
  await RequireAdminPermission("admin:operations");
  const supabase=await createClient();
  const [provider,payment,ddex,queuedJobs,failedJobs,emailFailed,webhookFailed,pendingEmail] = await Promise.all([
    getProviderConnectionState(),
    Promise.resolve(getPaymentConnectionState()),
    Promise.resolve(ddexConfigPublicStatus()),
    supabase.from("distribution_jobs").select("id",{count:"exact",head:true}).eq("status","queued"),
    supabase.from("distribution_jobs").select("id",{count:"exact",head:true}).eq("status","failed"),
    supabase.from("email_outbound_events").select("id",{count:"exact",head:true}).eq("status","failed"),
    supabase.from("provider_webhook_events").select("id",{count:"exact",head:true}).eq("process_status","failed"),
    supabase.from("email_outbound_events").select("id",{count:"exact",head:true}).in("status",["queued","pending","skipped"]),
  ]);
  return <div className="space-y-6">
    <PageHeader title="System Health & Integrations" description="Live operational snapshot from provider, payment, DDEX, distribution, webhook and email systems." />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Health label="Distribution provider" ok={provider.connected} detail={provider.connected?`${provider.providerName??"Provider"} connected`:provider.message}/>
      <Health label="Provider webhook" ok={provider.webhookConfigured} detail={provider.webhookConfigured?"Webhook secret configured":"Webhook configuration missing"}/>
      <Health label="Payment provider" ok={payment.connected} detail={payment.connected?`${payment.providerName??"Payment"} connected`:payment.message}/>
      <Health label="DDEX sender" ok={ddex.senderConfigured} detail={ddex.senderConfigured?"DDEX sender configured":"DDEX sender not ready"}/>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Distribution queued" value={queuedJobs.count??0} href="/admin/distribution/queue"/>
      <Metric label="Distribution failed" value={failedJobs.count??0} href="/admin/distribution/failed"/>
      <Metric label="Email pending / skipped" value={pendingEmail.count??0} href="/admin/email-deliverability"/>
      <Metric label="Email failed" value={emailFailed.count??0} href="/admin/email-deliverability"/>
      <Metric label="Webhook failed" value={webhookFailed.count??0} href="/admin/distribution/webhooks"/>
    </div>
  </div>;
}
function Health({label,ok,detail}:{label:string;ok:boolean;detail:string}) { return <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{label}</p><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${ok?"bg-emerald-600 text-white":"bg-red-600 text-white"}`}>{ok?"READY":"ACTION"}</span></div><p className="mt-2 text-caption text-[var(--nexo-text-muted)]">{detail}</p></div>; }
function Metric({label,value,href}:{label:string;value:number;href:string}) { return <Link href={href} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 hover:bg-[var(--nexo-elevated)]"><p className="text-caption text-[var(--nexo-text-muted)]">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></Link>; }
