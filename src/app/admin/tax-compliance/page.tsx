import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { OpsCaseCenter } from "@/components/admin/OpsCaseCenter";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { updateTaxComplianceAction } from "@/app/admin/operations/actions";

export const metadata: Metadata = { title:"Tax & Payout Compliance", robots:{index:false,follow:false} };

export default async function TaxCompliancePage() {
  await RequireAdminPermission("admin:finance");
  const supabase=await createClient();
  const {data:rows}=await supabase.from("tax_compliance_profiles").select("user_id,status,country_code,withholding_bps,hold_payouts,notes,reviewed_at").order("updated_at",{ascending:false}).limit(150);
  return <div className="space-y-6">
    <PageHeader title="Tax & Payout Compliance" description="Track tax-information readiness, withholding configuration and payout holds. No tax ID or bank credential is stored on this page." />
    <details className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"><summary className="cursor-pointer font-semibold">Update user tax status</summary>
      <form action={updateTaxComplianceAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input name="user_id" required placeholder="User UUID" />
        <Select name="status" defaultValue="required">{["not_required","required","submitted","reviewing","verified","expired","blocked"].map((x)=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</Select>
        <Input name="country_code" placeholder="Country / code" />
        <Input name="withholding_bps" type="number" min="0" max="10000" defaultValue="0" placeholder="Withholding basis points" />
        <label className="flex items-center gap-2 text-small"><input type="checkbox" name="hold_payouts"/> Hold payouts</label>
        <Textarea name="notes" placeholder="Internal compliance notes" className="sm:col-span-2" />
        <div className="sm:col-span-2"><Button type="submit">Save compliance status</Button></div>
      </form>
    </details>
    <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]"><table className="min-w-full text-left text-small"><thead><tr className="border-b border-[var(--nexo-border)]"><th className="p-3">User</th><th className="p-3">Status</th><th className="p-3">Country</th><th className="p-3">Withholding</th><th className="p-3">Payout hold</th><th className="p-3">Reviewed</th></tr></thead><tbody>{(rows??[]).map((row)=><tr key={row.user_id} className="border-b border-[var(--nexo-divider)]"><td className="p-3 font-mono text-caption">{row.user_id}</td><td className="p-3">{row.status}</td><td className="p-3">{row.country_code??"—"}</td><td className="p-3">{(row.withholding_bps/100).toFixed(2)}%</td><td className="p-3">{row.hold_payouts?"HOLD":"clear"}</td><td className="p-3">{row.reviewed_at?new Date(row.reviewed_at).toLocaleString():"—"}</td></tr>)}</tbody></table></div>
    <OpsCaseCenter caseType="tax_compliance" createLabel="Open tax/compliance case" />
  </div>;
}
