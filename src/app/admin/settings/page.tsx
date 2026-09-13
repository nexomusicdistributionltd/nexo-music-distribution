import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/admin/AdminSettingsForm";

export const metadata: Metadata = {
  title: "Admin settings",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  await RequireAdminPermission("admin:settings");
  const supabase = await createClient();
  const [{ data: settings }, { data: emailEvents }] = await Promise.all([
    supabase.from("admin_settings").select("*").order("key"),
    supabase
      .from("email_outbound_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Allowlisted operational settings only. Secrets never live in client-visible settings."
      />
      <Alert title="Secrets">
        Service role keys, DB passwords, and provider credentials stay in server env / secret
        stores — not in this table.
      </Alert>
      <SettingsForm />
      {(settings ?? []).length === 0 ? (
        <EmptyState title="No settings stored yet" />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] text-small">
          {(settings ?? []).map((s) => (
            <li key={s.key} className="px-4 py-3">
              <p className="font-medium">{s.key}</p>
              <pre className="mt-1 overflow-x-auto text-caption text-[var(--nexo-text-muted)]">
                {JSON.stringify(s.value)}
              </pre>
            </li>
          ))}
        </ul>
      )}
      <section>
        <h2 className="mb-2 text-h4">Outbound email events</h2>
        <p className="mb-3 text-small text-[var(--nexo-text-muted)]">
          Architecture for delivery history. Rows are not marked sent unless a real provider
          confirms.
        </p>
        {(emailEvents ?? []).length === 0 ? (
          <EmptyState title="No email events" description="Queued/skipped/failed/sent history will list here." />
        ) : (
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] text-small">
            {(emailEvents ?? []).map((e) => (
              <li key={e.id} className="px-4 py-3">
                {e.template_key} → {e.to_email} · {e.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
