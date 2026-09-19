import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import {
  PublicContactSettingsForm,
  SettingsForm,
  SettingsSecurityNotice,
} from "@/components/admin/AdminSettingsForm";

export const metadata: Metadata = {
  title: "Admin settings",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  await RequireAdminPermission("admin:settings");
  const supabase = await createClient();

  const [
    { data: settings },
    { data: emailEvents },
    { data: footerSetting },
  ] = await Promise.all([
    supabase.from("admin_settings").select("key,value,updated_at").order("key"),
    supabase
      .from("email_outbound_events")
      .select("id,template_key,to_email,status,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("website_settings")
      .select("key,value,updated_at")
      .eq("key", "footer")
      .maybeSingle(),
  ]);

  const initialSettings = Object.fromEntries(
    (settings ?? []).map((row) => [row.key, row.value])
  ) as Record<string, unknown>;
  const footerValue =
    footerSetting?.value && typeof footerSetting.value === "object" && !Array.isArray(footerSetting.value)
      ? (footerSetting.value as Record<string, unknown>)
      : {};

  const failedEmails = (emailEvents ?? []).filter((event) => event.status === "failed").length;
  const queuedEmails = (emailEvents ?? []).filter(
    (event) => event.status === "queued" || event.status === "pending"
  ).length;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Settings"
        description="Operational controls, public contact mailboxes, security boundaries, and delivery visibility for Nexo administration."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
          <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
            Operational settings
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{settings?.length ?? 0}</p>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Allowlisted non-secret controls.
          </p>
        </div>
        <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
          <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
            Email queue
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{queuedEmails}</p>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Queued or pending in the latest 20 events.
          </p>
        </div>
        <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
          <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
            Delivery issues
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{failedEmails}</p>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Failed events in the latest 20.
          </p>
        </div>
      </section>

      <SettingsSecurityNotice />

      <PublicContactSettingsForm initial={footerValue} />

      <section className="space-y-3">
        <div>
          <h2 className="text-h3">Platform controls</h2>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            Friendly controls backed by the existing allowlisted admin settings. Changes are
            audited and do not expose provider credentials.
          </p>
        </div>
        <SettingsForm initialSettings={initialSettings} />
      </section>

      <section className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
        <div className="border-b border-[var(--nexo-border)] bg-[var(--nexo-elevated)]/45 px-5 py-4">
          <h2 className="text-h4">Outbound email activity</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Recent delivery events. A row is only shown as sent when the configured provider
            confirms it.
          </p>
        </div>

        {(emailEvents ?? []).length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No email events"
              description="Queued, sent, skipped, and failed delivery events will appear here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--nexo-border)] text-small">
            {(emailEvents ?? []).map((event) => (
              <li
                key={event.id}
                className="grid gap-1 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{event.template_key}</p>
                  <p className="truncate text-caption text-[var(--nexo-text-muted)]">
                    {event.to_email}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-caption text-[var(--nexo-text-muted)]">
                  <span className="capitalize">{event.status}</span>
                  <time dateTime={event.created_at}>
                    {new Date(event.created_at).toLocaleString()}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
