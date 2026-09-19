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
  const [{ data: settings }, { data: emailEvents }, { data: footerSetting }] =
    await Promise.all([
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

  const footer =
    footerSetting?.value &&
    typeof footerSetting.value === "object" &&
    !Array.isArray(footerSetting.value)
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
        description="Operational controls, public contact mailboxes, security boundaries, and delivery visibility."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Configuration"
          value={String((settings ?? []).length)}
          detail="Stored operational settings"
        />
        <SummaryCard
          label="Email queue"
          value={String(queuedEmails)}
          detail="Queued or pending in the latest 20 events"
        />
        <SummaryCard
          label="Delivery issues"
          value={String(failedEmails)}
          detail="Failed events in the latest 20"
        />
      </section>

      <SettingsSecurityNotice />

      <PublicContactSettingsForm initial={footer} />

      <section className="space-y-3">
        <div>
          <h2 className="text-h3">Platform controls</h2>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            Friendly controls backed by the existing allowlisted settings. Changes are audited.
          </p>
        </div>
        <SettingsForm
          settings={(settings ?? []).map((row) => ({ key: row.key, value: row.value }))}
        />
      </section>

      <section className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
        <div className="border-b border-[var(--nexo-border)] bg-[var(--nexo-elevated)]/50 px-5 py-4">
          <h2 className="text-h4">Outbound email activity</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Recent delivery events. Rows are only marked sent after provider confirmation.
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

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
      <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{detail}</p>
    </div>
  );
}
