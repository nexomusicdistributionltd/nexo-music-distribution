"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import {
  createSupportTicket,
  replySupportTicket,
} from "@/app/(portal)/support/actions";

export function CreateTicketForm() {
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const r = await createSupportTicket({ subject, body });
        setPending(false);
        if (!r.ok) setError(r.error);
        else window.location.assign(`/support?ticket=${r.id}`);
      }}
    >
      <h2 className="text-h4">Open a ticket</h2>
      <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" required />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="How can we help?" rows={4} required />
      {error ? <Alert variant="warning">{error}</Alert> : null}
      <Button type="submit" disabled={pending}>Create ticket</Button>
    </form>
  );
}

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const form = e.currentTarget;
        const r = await replySupportTicket(ticketId, new FormData(form));
        setPending(false);
        if (!r.ok) setError(r.error);
        else router.refresh();
      }}
    >
      <Textarea name="body" rows={3} required placeholder="Reply" />
      <label className="block text-small">
        <span className="mb-1 block text-label">Attachment (optional, private)</span>
        <input name="attachment" type="file" accept=".pdf,.txt,image/jpeg,image/png,image/webp" />
      </label>
      {error ? <Alert variant="warning">{error}</Alert> : null}
      <Button type="submit" disabled={pending}>Send reply</Button>
    </form>
  );
}
