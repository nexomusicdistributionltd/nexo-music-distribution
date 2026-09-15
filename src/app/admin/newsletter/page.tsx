import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { NewsletterRealtime } from "@/components/admin/NewsletterRealtime";
import { NewsletterComposer } from "@/components/admin/NewsletterComposer";
import { isEmailProviderConfigured, resolveEmailProviderName } from "@/lib/email/newsletter-send";

export const metadata: Metadata = {
  title: "Newsletter",
  robots: { index: false, follow: false },
};

export default async function AdminNewsletterPage() {
  await RequireAdminPermission("admin:newsletter");
  const supabase = await createClient();

  const [{ data: subscribers }, { data: campaigns }, { count: activeCount }] = await Promise.all([
    supabase
      .from("newsletter_subscribers")
      .select("id, email, status, source, subscribed_at, unsubscribed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("newsletter_campaigns")
      .select("id, subject, status, recipient_count, created_at, sent_at, error")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const providerConnected = isEmailProviderConfigured();
  const providerName = resolveEmailProviderName();

  return (
    <div>
      <NewsletterRealtime />
      <PageHeader
        title="Newsletter"
        description="Subscribers and campaign composer. Sends use the same Zoho SMTP transport as the Email Center (`sendViaZohoSmtp`) and log to email_outbound_events — never fake delivered. Unsubscribe stays on every campaign."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
          <p className="text-caption text-[var(--nexo-text-muted)]">Active subscribers</p>
          <p className="mt-1 text-h3">{activeCount ?? 0}</p>
        </div>
        <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
          <p className="text-caption text-[var(--nexo-text-muted)]">Listed</p>
          <p className="mt-1 text-h3">{(subscribers ?? []).length}</p>
        </div>
        <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
          <p className="text-caption text-[var(--nexo-text-muted)]">Email provider</p>
          <p className="mt-1 text-h4">
            {providerConnected ? providerName ?? "configured" : "Not Connected"}
          </p>
          {!providerConnected ? (
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              Campaigns queue as pending only — never marked sent.
            </p>
          ) : null}
        </div>
      </div>

      <NewsletterComposer providerConnected={providerConnected} />

      <h2 className="mt-10 text-h4">Recent campaigns</h2>
      {(campaigns ?? []).length === 0 ? (
        <EmptyState className="mt-4" title="No campaigns yet" description="Compose a message above." />
      ) : (
        <ul className="mt-4 space-y-2">
          {(campaigns ?? []).map((c) => (
            <li
              key={c.id}
              className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{c.subject}</p>
                <Badge>{c.status}</Badge>
              </div>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                {c.recipient_count} recipients · {new Date(c.created_at).toLocaleString()}
                {c.sent_at ? ` · sent ${new Date(c.sent_at).toLocaleString()}` : ""}
              </p>
              {c.error ? (
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{c.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-h4">Subscribers</h2>
      {(subscribers ?? []).length === 0 ? (
        <EmptyState
          className="mt-4"
          title="No subscribers"
          description="Public footer signups will appear here with realtime refresh."
        />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          <table className="min-w-full text-left text-small">
            <thead className="border-b border-[var(--nexo-border)] bg-[var(--nexo-surface)] text-caption uppercase tracking-[0.08em] text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {(subscribers ?? []).map((s) => (
                <tr key={s.id} className="border-b border-[var(--nexo-divider)] last:border-0">
                  <td className="px-4 py-3">{s.email}</td>
                  <td className="px-4 py-3">
                    <Badge>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--nexo-text-muted)]">{s.source}</td>
                  <td className="px-4 py-3 text-[var(--nexo-text-muted)]">
                    {new Date(s.subscribed_at ?? s.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
