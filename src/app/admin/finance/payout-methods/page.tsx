import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { FinanceNav } from "@/components/finance/FinanceNav";
import { AdminPayoutMethodsClient } from "@/components/finance/AdminPayoutMethodsClient";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Payout methods",
  robots: { index: false, follow: false },
};

export default async function AdminPayoutMethodsPage() {
  await RequireAdminPermission("admin:payouts");
  const supabase = await createClient();
  const { data } = await supabase
    .from("payout_methods")
    .select("id,user_id,method_type,display_name,country_code,currency,beneficiary_name,details,provider,is_preferred,status,admin_note,profiles!payout_methods_user_id_fkey(email,display_name,full_name)")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payout methods"
        description="Manage account payout preferences. Manual Nexo processing stays available while an automated payout API is not enabled."
      />
      <FinanceNav />
      {(data ?? []).length === 0 ? <EmptyState title="No payout methods saved yet" /> : null}
      <AdminPayoutMethodsClient rows={(data ?? []) as never[]} />
    </div>
  );
}
