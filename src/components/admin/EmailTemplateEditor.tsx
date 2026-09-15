"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import {
  updateEmailTemplateAction,
  deleteEmailTemplateAction,
} from "@/app/admin/emails/actions";

export function EmailTemplateEditor({
  templateKey,
  name,
  category,
  subject,
  htmlBody,
  canDelete,
}: {
  templateKey: string;
  name: string;
  category: string;
  subject: string;
  htmlBody: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [tplName, setTplName] = React.useState(name);
  const [tplSubject, setTplSubject] = React.useState(subject);
  const [html, setHtml] = React.useState(htmlBody);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(true);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        setOk(null);
        const res = await updateEmailTemplateAction({
          key: templateKey,
          name: tplName,
          subject: tplSubject,
          htmlBody: html,
        });
        setPending(false);
        if (!res.ok) setError(res.error);
        else setOk("Saved. Sends use this HTML; SENT is still only set after a real provider accept.");
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-small">
          <span className="text-[var(--nexo-text-muted)]">Name</span>
          <Input value={tplName} onChange={(e) => setTplName(e.target.value)} required />
        </label>
        <label className="space-y-1 text-small">
          <span className="text-[var(--nexo-text-muted)]">Key</span>
          <Input value={templateKey} disabled />
        </label>
      </div>
      <label className="block space-y-1 text-small">
        <span className="text-[var(--nexo-text-muted)]">Subject</span>
        <Input value={tplSubject} onChange={(e) => setTplSubject(e.target.value)} required />
      </label>
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Category: {category}. Keep the dark Nexo shell (#050505 / #0a0a0a, white/silver type). Do not add album
        artwork. Placeholders like {"{{FIRST_NAME}}"} are escaped at send time.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? "Hide preview" : "Show preview"}
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save template"}
        </Button>
        {canDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            className="border-[var(--nexo-error)] text-[var(--nexo-error)]"
            onClick={async () => {
              if (!window.confirm(`Delete custom template ${templateKey}?`)) return;
              setPending(true);
              const res = await deleteEmailTemplateAction(templateKey);
              setPending(false);
              if (!res.ok) setError(res.error);
              else router.push("/admin/emails/templates");
            }}
          >
            Delete
          </Button>
        ) : null}
      </div>
      {error ? (
        <Alert variant="warning" title="Could not save">
          {error}
        </Alert>
      ) : null}
      {ok ? <Alert variant="success" title="Saved">{ok}</Alert> : null}
      <div className={`grid gap-4 ${showPreview ? "xl:grid-cols-2" : ""}`}>
        <label className="block space-y-1 text-small">
          <span className="text-[var(--nexo-text-muted)]">HTML body</span>
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            required
            spellCheck={false}
            className="min-h-[28rem] font-mono text-caption"
          />
        </label>
        {showPreview ? (
          <div className="space-y-1 text-small">
            <span className="text-[var(--nexo-text-muted)]">Preview</span>
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={html}
              className="min-h-[28rem] w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[#050505]"
            />
          </div>
        ) : null}
      </div>
    </form>
  );
}
