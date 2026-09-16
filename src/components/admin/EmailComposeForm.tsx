"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { saveDraftAction, sendComposedEmailAction } from "@/app/admin/emails/actions";
import { AdminRecipientPicker } from "@/components/admin/AdminRecipientPicker";
import { mergeAddressField } from "@/lib/email/addresses";
import { brandedHtmlFromShellOrFallback } from "@/lib/email/branded-html";
import { bodyToPreviewHtml } from "@/lib/email/newsletter-html";
import type { DirectoryRecipient } from "@/lib/email/directory";

export type ComposeTemplateSuggestion = {
  key: string;
  name: string;
  subject: string;
  html_body: string;
};

export function EmailComposeForm({
  defaultTo = "",
  defaultCc = "",
  defaultBcc = "",
  defaultSubject = "",
  defaultHtml = "",
  inReplyTo = "",
  references = "",
  draftId = "",
  providerConfigured,
  providerMessage,
  directory = [],
  templates = [],
  shellHtml = "",
}: {
  defaultTo?: string;
  defaultCc?: string;
  defaultBcc?: string;
  defaultSubject?: string;
  defaultHtml?: string;
  inReplyTo?: string;
  references?: string;
  draftId?: string;
  providerConfigured: boolean;
  providerMessage: string;
  directory?: DirectoryRecipient[];
  templates?: ComposeTemplateSuggestion[];
  shellHtml?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [to, setTo] = React.useState(defaultTo);
  const [cc, setCc] = React.useState(defaultCc);
  const [bcc, setBcc] = React.useState(defaultBcc);
  const [subject, setSubject] = React.useState(defaultSubject);
  const [body, setBody] = React.useState(defaultHtml);

  const previewHtml = React.useMemo(
    () =>
      brandedHtmlFromShellOrFallback(shellHtml, {
        subject: subject || "(Subject)",
        bodyHtml: bodyToPreviewHtml(body),
      }),
    [shellHtml, subject, body]
  );

  function applyTemplate(t: ComposeTemplateSuggestion) {
    setSubject(t.subject);
    setBody(t.html_body);
    setPreview(true);
  }

  async function onSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const result = await sendComposedEmailAction(fd);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.data.message);
    if (result.data.status === "sent") {
      router.push("/admin/emails/sent");
    }
  }

  async function onSaveDraft() {
    setPending(true);
    setError(null);
    const result = await saveDraftAction({
      id: draftId || undefined,
      to,
      cc,
      bcc,
      subject,
      htmlBody: body,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined,
    });
    setPending(false);
    if (!result.ok) setError(result.error);
    else setMessage("Draft saved on the server.");
  }

  return (
    <form onSubmit={onSend} className="space-y-4" encType="multipart/form-data">
      <Alert variant={providerConfigured ? "success" : "warning"} title="Zoho SMTP">
        {providerMessage} This path never uses Resend. AI/bots are not required.
      </Alert>
      <input type="hidden" name="in_reply_to" value={inReplyTo} />
      <input type="hidden" name="references" value={references} />
      <input type="hidden" name="draft_id" value={draftId} />
      <input type="hidden" name="branded" value="1" />
      <AdminRecipientPicker
        directory={directory}
        selectedKeys={[]}
        onSelectedKeysChange={() => undefined}
        customEmails={[]}
        onCustomEmailsChange={() => undefined}
        mode="append"
        onAppendEmails={(emails, target) => {
          if (target === "cc") setCc((current) => mergeAddressField(current, emails));
          else if (target === "bcc") setBcc((current) => mergeAddressField(current, emails));
          else setTo((current) => mergeAddressField(current, emails));
        }}
        disabled={pending}
      />
      <label className="block space-y-1 text-small">
        <span className="text-[var(--nexo-text-muted)]">To</span>
        <Input
          name="to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
          placeholder="name@example.com, another@example.com"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-small">
          <span className="text-[var(--nexo-text-muted)]">CC</span>
          <Input name="cc" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="optional" />
        </label>
        <label className="block space-y-1 text-small">
          <span className="text-[var(--nexo-text-muted)]">BCC</span>
          <Input name="bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="optional" />
        </label>
      </div>
      <label className="block space-y-1 text-small">
        <span className="text-[var(--nexo-text-muted)]">Subject</span>
        <Input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </label>
      {templates.length > 0 ? (
        <div className="space-y-2">
          <p className="text-caption text-[var(--nexo-text-muted)]">Template suggestions</p>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.key}
                type="button"
                className="rounded-full border border-[var(--nexo-border)] px-3 py-1 text-caption hover:bg-[var(--nexo-ghost-hover)]"
                onClick={() => applyTemplate(t)}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <label className="block space-y-1 text-small">
        <span className="text-[var(--nexo-text-muted)]">Body (HTML or plain text)</span>
        <Textarea
          name="body_html"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={12}
          className="font-mono text-caption"
        />
      </label>
      <label className="block space-y-1 text-small">
        <span className="text-[var(--nexo-text-muted)]">Attachments (pdf/images/txt, max 8MB)</span>
        <input
          type="file"
          name="attachments"
          multiple
          className="text-caption text-[var(--nexo-text-muted)]"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setPreview((p) => !p)}>
          {preview ? "Hide preview" : "Preview"}
        </Button>
        <Button type="button" variant="outline" onClick={onSaveDraft} disabled={pending}>
          Save draft
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Sending…" : providerConfigured ? "Send via Zoho" : "Queue (SMTP not connected)"}
        </Button>
      </div>
      {preview ? (
        <div className="overflow-hidden rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[#050505]">
          <p className="border-b border-[var(--nexo-border)] px-3 py-2 text-caption text-[var(--nexo-text-muted)]">
            Branded HTML preview
          </p>
          <iframe title="Email branded preview" className="h-[28rem] w-full bg-[#050505]" sandbox="" srcDoc={previewHtml} />
        </div>
      ) : null}
      {message ? <Alert title="Result">{message}</Alert> : null}
      {error ? (
        <Alert variant="warning" title="Not sent">
          {error}
        </Alert>
      ) : null}
    </form>
  );
}
