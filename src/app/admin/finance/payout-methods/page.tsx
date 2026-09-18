import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { FinanceNav } from "@/components/finance/FinanceNav";
import { AdminPayoutMethodsClient } from "@/components/finance/AdminPayoutMethodsClient";
import { AdminPayoutMethodOptionsClient } from "@/components/finance/AdminPayoutMethodOptionsClient";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Payout methods",
  robots: { index: false, follow: false },
};

export default async function AdminPayoutMethodsPage() {
  await RequireAdminPermission("admin:payouts");
  const supabase = await createClient();
  const [{ data }, { data: options }] = await Promise.all([
    supabase
    .from("payout_methods")
    .select("id,user_id,method_type,display_name,country_code,currency,beneficiary_name,details,provider,is_preferred,status,admin_note,profiles!payout_methods_user_id_fkey(email,display_name,full_name)")
    .order("created_at", { ascending: false })
    .limit(300),
    supabase
      .from("payout_method_options")
      .select("id,code,display_name,method_type,destination_label,instructions,requires_institution,requires_country,requires_currency,requires_review,allowed_countries,allowed_currencies,is_enabled,sort_order")
      .order("sort_order", { ascending: true })
      .order("display_name", { ascending: true }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payout methods"
        description="Manage account payout preferences. Manual Nexo processing stays available while an automated payout API is not enabled."
      />
      <FinanceNav />
      <AdminPayoutMethodOptionsClient rows={(options ?? []) as never[]} />
      <section className="space-y-3">
        <h2 className="text-h4">Account payout destinations</h2>
        <p className="text-small text-[var(--nexo-text-muted)]">Review the receiving details Artists and Labels submit from their Wallet.</p>
        {(data ?? []).length === 0 ? <EmptyState title="No account payout methods saved yet" /> : null}
        <AdminPayoutMethodsClient rows={(data ?? []) as never[]} />
      </section>
    </div>
  );
}
