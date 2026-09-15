import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { getEmailProviderStatus } from "@/lib/email/provider";
import { isZohoImapConfigured } from "@/lib/email/zoho-imap";
import { InboxSyncButton } from "@/components/admin/InboxSyncButton";
import { buttonVariants } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Email inbox",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminEmailsInboxPage() {
  await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const provider = getEmailProviderStatus();
  const imapConfigured = isZohoImapConfigured();

  const { data, error } = await supabase
    .from("email_inbox_messages")
    .select(
      "id, from_email, from_name, to_emails, subject, sent_at, seen, thread_key, created_at"
    )
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(100);

  const rows = data ?? [];

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Received mail from Zoho IMAP (imap.zoho.com). This list is not copied from sent/outbox events. Sync is server-side — mailbox credentials never reach the browser. Core send/inbox/reply works with zero AI credits."
        actions={<InboxSyncButton imapConfigured={imapConfigured} />}
      />
      <Alert variant={imapConfigured ? "success" : "warning"} title="IMAP" className="mb-4">
        {imapConfigured
          ? "Zoho IMAP uses the same mailbox credentials as SMTP. Click Sync to fetch INBOX."
          : "Zoho IMAP is not configured (needs SMTP_USER + password). Inbox will stay empty until sync is possible — it will not be faked from outbound events."}{" "}
        SMTP: {provider.message}
      </Alert>
      {error ? (
        <p className="text-small text-red-400">Failed to load: {error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No synced messages"
          description={
            imapConfigured
              ? "Click Sync Zoho inbox to fetch mail."
              : "Configure Zoho mailbox env vars, then sync."
          }
          action={
            <Link href="/admin/emails/compose" className={buttonVariants({ size: "sm" })}>
              Compose
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          <table className="min-w-full text-left text-small">
            <thead className="bg-[var(--nexo-surface)] text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Read</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nexo-border)]">
              {rows.map((row) => {
                const toList = Array.isArray(row.to_emails) ? row.to_emails.join(", ") : "";
                return (
                  <tr key={row.id} className={row.seen ? "" : "bg-[var(--nexo-elevated)]"}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/emails/inbox/${row.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {row.from_name || row.from_email}
                      </Link>
                      <p className="text-caption text-[var(--nexo-text-muted)]">{row.from_email}</p>
                    </td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-caption">{toList || "—"}</td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/emails/inbox/${row.id}`} className="hover:underline">
                        {row.subject}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-caption">
                      {row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge>{row.seen ? "read" : "unread"}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
