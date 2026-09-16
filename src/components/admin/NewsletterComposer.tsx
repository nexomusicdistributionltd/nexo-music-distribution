"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { createAndSendNewsletterCampaign } from "@/app/admin/newsletter/actions";
import { bodyToPreviewHtml, buildNewsletterHtml } from "@/lib/email/newsletter-html";
import { NEXO_EMAIL_BRAND } from "@/lib/email/brand";

export function NewsletterComposer({ providerConnected }: { providerConnected: boolean }) {
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [preview, setPreview] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const previewHtml = React.useMemo(
    () =>
      buildNewsletterHtml({
        subject: subject || "(Subject)",
        bodyHtml: bodyToPreviewHtml(body),
        unsubscribeUrl: `${NEXO_EMAIL_BRAND.website}/newsletter/unsubscribe?token=preview`,
        siteUrl: NEXO_EMAIL_BRAND.website,
      }),
    [subject, body]
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    setError(null);
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("body_html", body);
    const result = await createAndSendNewsletterCampaign(fd);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message);
    setSubject("");
    setBody("");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5"
    >
      <h2 className="text-h4">Composer</h2>
      {!providerConnected ? (
        <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
          Provider Not Connected — you can still compose; messages stay pending/queued and are never
          marked sent.
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Input
            name="subject"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            maxLength={300}
            aria-label="Campaign subject"
          />
          <Textarea
            name="body_html"
            placeholder="Message body (plain text or simple HTML)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={10}
            aria-label="Campaign body"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setPreview((p) => !p)}>
              {preview ? "Hide preview" : "Show branded preview"}
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? "Sending…" : providerConnected ? "Send to active subscribers" : "Queue campaign"}
            </Button>
          </div>
          {message ? <p className="text-caption text-[var(--nexo-text-muted)]">{message}</p> : null}
          {error ? <p className="text-caption text-red-500">{error}</p> : null}
        </div>
        {preview ? (
          <div className="min-h-[28rem] overflow-hidden rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[#0a0a0a]">
            <p className="border-b border-[var(--nexo-border)] px-3 py-2 text-caption text-[var(--nexo-text-muted)]">
              Live branded HTML (same shell as send)
            </p>
            <iframe
              title="Newsletter branded preview"
              className="h-[26rem] w-full bg-[#0a0a0a]"
              sandbox=""
              srcDoc={previewHtml}
            />
          </div>
        ) : null}
      </div>
    </form>
  );
}
