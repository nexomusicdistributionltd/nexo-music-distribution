"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { replyContactMessageAction, updateContactStatusAction } from "@/app/admin/actions";

export function ContactInboxActions({
  id,
  status,
  senderEmail,
}: {
  id: string;
  status: string;
  senderEmail: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  async function setStatus(next: string) {
    setPending(next);
    setError(null);
    const res = await updateContactStatusAction({ id, status: next });
    setPending(null);
    if (!res.ok) setError(res.error);
    else refresh();
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    setPending("reply");
    setError(null);
    setOk(null);
    const res = await replyContactMessageAction({ id, body: reply });
    setPending(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOk(`Sent branded reply to ${senderEmail}.`);
    setReply("");
    refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status !== "triaged" ? (
          <Button size="sm" variant="secondary" disabled={!!pending} onClick={() => void setStatus("triaged")}>
            {pending === "triaged" ? "…" : "Triage"}
          </Button>
        ) : null}
        {status !== "closed" ? (
          <Button size="sm" variant="ghost" disabled={!!pending} onClick={() => void setStatus("closed")}>
            {pending === "closed" ? "…" : "Close"}
          </Button>
        ) : null}
      </div>
      <form onSubmit={sendReply} className="space-y-2">
        <label className="block space-y-1">
          <span className="text-caption text-[var(--nexo-text-muted)]">
            Reply to {senderEmail} (branded Nexo HTML via Zoho)
          </span>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={6}
            required
            placeholder="Write the reply the visitor will receive…"
          />
        </label>
        <Button type="submit" size="sm" disabled={!!pending || !reply.trim()} aria-busy={pending === "reply"}>
          {pending === "reply" ? "Sending…" : "Send branded reply"}
        </Button>
      </form>
      {ok ? <Alert title="Sent">{ok}</Alert> : null}
      {error ? (
        <Alert variant="warning" title="Not sent">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
