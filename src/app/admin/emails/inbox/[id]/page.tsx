import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { resolveZohoSmtpConfig } from "@/lib/email/zoho-smtp";
import { buildReplyHeaders } from "@/lib/email/thread";

export const metadata: Metadata = {
  title: "Email message",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminEmailMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await RequireAdminPermission("admin:emails");
  const { id } = await params;
  const supabase = await createClient();
  const { data: msg, error } = await supabase
    .from("email_inbox_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return <p className="text-small text-red-400">{error.message}</p>;
  }
  if (!msg) notFound();

  if (!msg.seen) {
    await supabase.from("email_inbox_messages").update({ seen: true }).eq("id", id);
  }

  const { data: attachments } = await supabase
    .from("email_inbox_attachments")
    .select("id, filename, content_type, byte_size, trusted, storage_path")
    .eq("message_id", id);

  const threadKey = String(msg.thread_key ?? "");
  const { data: thread } = threadKey
    ? await supabase
        .from("email_inbox_messages")
        .select("id, subject, from_email, sent_at")
        .eq("thread_key", threadKey)
        .order("sent_at", { ascending: true })
        .limit(20)
    : { data: [] };

  const self = resolveZohoSmtpConfig()?.user ?? "contact@nexomusicdistro.space";
  const to = Array.isArray(msg.to_emails) ? (msg.to_emails as string[]) : [];
  const cc = Array.isArray(msg.cc_emails) ? (msg.cc_emails as string[]) : [];
  const replyHeaders = buildReplyHeaders({
    originalMessageId: String(msg.message_id ?? ""),
    originalReferences: msg.references_header ? String(msg.references_header) : null,
  });
  const replyAllTo = [...new Set([msg.from_email, ...to, ...cc].filter((e) => e && e !== self))].join(
    ","
  );
  const replyQs = new URLSearchParams({
    replyTo: String(msg.from_email ?? ""),
    subject: String(msg.subject ?? ""),
    inReplyTo: replyHeaders.inReplyTo,
    references: replyHeaders.references,
    inboxId: id,
  });
  const replyAllQs = new URLSearchParams(replyQs);
  replyAllQs.set("to", replyAllTo);
  replyAllQs.set("replyAll", "1");

  return (
    <div>
      <PageHeader
        title={msg.subject || "(no subject)"}
        description={`${msg.from_name || msg.from_email} → ${to.join(", ") || "—"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/emails/compose?${replyQs.toString()}`}
              className={buttonVariants({ size: "sm" })}
            >
              Reply
            </Link>
            <Link
              href={`/admin/emails/compose?${replyAllQs.toString()}`}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Reply all
            </Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2 text-caption text-[var(--nexo-text-muted)]">
        <Badge>{msg.seen ? "read" : "unread"}</Badge>
        <span>{msg.sent_at ? new Date(msg.sent_at).toLocaleString() : "—"}</span>
        {msg.message_id ? <span>Message-ID: {msg.message_id}</span> : null}
      </div>
      {cc.length ? (
        <p className="mb-2 text-caption text-[var(--nexo-text-muted)]">CC: {cc.join(", ")}</p>
      ) : null}
      <div
        className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[#050505] p-4 text-small text-[#e5e5e5]"
        dangerouslySetInnerHTML={{
          __html: msg.html_body || `<pre>${msg.text_body || ""}</pre>`,
        }}
      />
      {(attachments ?? []).length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-h4">Attachments</h2>
          <ul className="space-y-1 text-small">
            {(attachments ?? []).map((a) => (
              <li key={a.id}>
                {a.trusted && a.storage_path ? (
                  <a
                    className="underline-offset-4 hover:underline"
                    href={`/api/admin/emails/attachments/${a.id}`}
                  >
                    {a.filename}
                  </a>
                ) : (
                  <span>
                    {a.filename}{" "}
                    <span className="text-caption text-[var(--nexo-text-muted)]">
                      (untrusted — not downloadable)
                    </span>
                  </span>
                )}{" "}
                <span className="text-caption text-[var(--nexo-text-muted)]">
                  {a.content_type} · {a.byte_size} bytes
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {(thread ?? []).length > 1 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-h4">Thread</h2>
          <ul className="space-y-1 text-small">
            {(thread ?? []).map((t) => (
              <li key={t.id}>
                <Link href={`/admin/emails/inbox/${t.id}`} className="hover:underline">
                  {t.subject}
                </Link>{" "}
                <span className="text-caption text-[var(--nexo-text-muted)]">
                  {t.from_email} · {t.sent_at ? new Date(t.sent_at).toLocaleString() : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Alert className="mt-6" title="Thread">
          Thread grouping uses In-Reply-To / References when IMAP provides them.
        </Alert>
      )}
    </div>
  );
}
