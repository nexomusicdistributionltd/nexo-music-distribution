"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { createEmailTemplateFromShellAction } from "@/app/admin/emails/actions";

export function CreateFromShellForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [key, setKey] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [preheader, setPreheader] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await createEmailTemplateFromShellAction({
          name,
          key: key || undefined,
          subject: subject || undefined,
          preheader: preheader || undefined,
        });
        setPending(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(`/admin/emails/templates/${encodeURIComponent(res.data.key)}`);
      }}
    >
      <label className="block space-y-1 text-small">
        <span className="text-[var(--nexo-text-muted)]">Name</span>
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Artist update — April"
        />
      </label>
      <label className="block space-y-1 text-small">
        <span className="text-[var(--nexo-text-muted)]">Key (optional)</span>
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          placeholder="ARTIST_UPDATE_APRIL"
        />
      </label>
      <label className="block space-y-1 text-small">
        <span className="text-[var(--nexo-text-muted)]">Subject (optional)</span>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Defaults to the name"
        />
      </label>
      <label className="block space-y-1 text-small">
        <span className="text-[var(--nexo-text-muted)]">Preheader (optional)</span>
        <Input
          value={preheader}
          onChange={(e) => setPreheader(e.target.value)}
          placeholder="Hidden inbox preview line"
        />
      </label>
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Creates a custom template by cloning the dark Nexo shell (CloudFront wordmark, icon_light footer, LTD
        tagline, social icons). Edit the body after create.
      </p>
      {error ? (
        <Alert variant="warning" title="Could not create">
          {error}
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create from dark shell"}
      </Button>
    </form>
  );
}
