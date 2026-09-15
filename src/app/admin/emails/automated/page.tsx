import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_AUTOMATION_SPECS } from "@/lib/email/automations";
import { EmailAutomationsTable } from "@/components/admin/EmailAutomationsTable";
import { Alert } from "@/components/ui/Alert";
import { getEmailProviderStatus } from "@/lib/email/provider";

export const metadata: Metadata = {
  title: "Automated emails",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminEmailsAutomatedPage() {
  await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const provider = getEmailProviderStatus();
  const { data } = await supabase
    .from("email_automations")
    .select("key, catalog_key, name, trigger_label, recipient_type, enabled, dormant, hosted_by_supabase, updated_at");

  const byKey = new Map((data ?? []).map((row) => [String(row.key), row]));
  const rows = EMAIL_AUTOMATION_SPECS.map((spec) => {
    const stored = byKey.get(spec.key);
    return {
      key: spec.key,
      catalogKey: spec.catalogKey,
      name: stored?.name ?? spec.name,
      trigger: stored?.trigger_label ?? spec.trigger,
      recipientType: stored?.recipient_type ?? spec.recipientType,
      enabled: stored ? Boolean(stored.enabled) : spec.enabledByDefault,
      dormant: stored ? Boolean(stored.dormant) : spec.dormant,
      hostedBySupabase: stored ? Boolean(stored.hosted_by_supabase) : spec.hostedBySupabase,
      updatedAt: stored?.updated_at ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Automated emails"
        description="Event-driven NexoBot catalog hooks. Toggles do not send mail. Auth templates stay on hosted Supabase. LIVE/DELIVERED stay dormant until a real provider callback."
      />
      <Alert variant={provider.configured ? "success" : "warning"} title="Send path" className="mb-4">
        {provider.message} Release status never depends on SMTP success.
      </Alert>
      <EmailAutomationsTable rows={rows} />
    </div>
  );
}
