import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Operations Center", robots: { index:false, follow:false } };

const centers = [
  ["/admin/rights","Rights & Claims","rights_claim"],
  ["/admin/fraud","Fraud & Streaming Risk","fraud_review"],
  ["/admin/conflicts","Catalog Conflicts","catalog_conflict"],
  ["/admin/security","User Security","security_review"],
  ["/admin/privacy","Privacy Requests","privacy_request"],
  ["/admin/tax-compliance","Tax & Payout Compliance","tax_compliance"],
  ["/admin/email-deliverability","Email Deliverability","email_deliverability"],
] as const;

export default async function OperationsPage() {
  await RequireAdminPermission("admin:operations");
  const supabase = await createClient();
  const { data } = await supabase.from("admin_ops_cases").select("case_type,status,priority");
  return <div className="space-y-6">
    <PageHeader title="Operations Center" description="One control surface for rights, fraud, conflicts, security, privacy, tax and deliverability investigations." />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {centers.map(([href,label,type]) => {
        const rows=(data??[]).filter((row)=>row.case_type===type && !["resolved","closed"].includes(row.status));
        const urgent=rows.filter((row)=>row.priority==="urgent").length;
        return <Link key={href} href={href} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 transition-colors hover:bg-[var(--nexo-elevated)]">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{label}</h2><span className="rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">{rows.length}</span></div>
          <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">{urgent ? `${urgent} urgent · ` : ""}{rows.length} open / active</p>
        </Link>;
      })}
    </div>
  </div>;
}
