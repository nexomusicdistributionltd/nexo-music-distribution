"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { createAndSendNewsletterCampaign } from "@/app/admin/newsletter/actions";

export function NewsletterComposer({ providerConnected }: { providerConnected: boolean }) {
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [preview, setPreview] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      <div className="mt-4 space-y-3">
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
          rows={8}
          aria-label="Campaign body"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setPreview((p) => !p)}>
            {preview ? "Hide preview" : "Preview"}
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? "Sending…" : providerConnected ? "Send to active subscribers" : "Queue campaign"}
          </Button>
        </div>
        {preview ? (
          <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-4">
            <p className="text-label">{subject || "(Subject)"}</p>
            <div className="mt-3 whitespace-pre-wrap text-small text-[var(--nexo-text-secondary)]">
              {body || "(Body)"}
            </div>
          </div>
        ) : null}
        {message ? <p className="text-caption text-[var(--nexo-text-muted)]">{message}</p> : null}
        {error ? <p className="text-caption text-red-500">{error}</p> : null}
      </div>
    </form>
  );
}
