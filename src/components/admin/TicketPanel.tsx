"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { updateTicketAction } from "@/app/admin/actions";

export function TicketPanel({
  ticketId,
  messages,
}: {
  ticketId: string;
  messages: {
    id: string;
    body: string;
    is_internal: boolean;
    created_at: string;
    author_user_id: string;
  }[];
}) {
  const router = useRouter();
  const [reply, setReply] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [status, setStatus] = React.useState("open");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <h2 className="text-h4">Conversation</h2>
      <ul className="max-h-80 space-y-2 overflow-y-auto text-small">
        {messages.length === 0 ? (
          <li className="text-[var(--nexo-text-muted)]">No messages yet.</li>
        ) : (
          messages.map((m) => (
            <li key={m.id} className="rounded-[var(--nexo-radius)] bg-[var(--nexo-elevated)] p-2">
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {new Date(m.created_at).toLocaleString()}
                {m.is_internal ? " · internal" : ""}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </li>
          ))
        )}
      </ul>
      <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
        <option value="open">open</option>
        <option value="pending">pending</option>
        <option value="awaiting_user">awaiting_user</option>
        <option value="resolved">resolved</option>
        <option value="closed">closed</option>
      </Select>
      <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} placeholder="Reply" />
      <label className="flex items-center gap-2 text-small">
        <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
        Internal note
      </label>
      {error ? <p className="text-caption text-red-500">{error}</p> : null}
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const r = await updateTicketAction({
            ticketId,
            status,
            reply: reply || undefined,
            internal,
          });
          setPending(false);
          if (!r.ok) setError(r.error);
          else router.refresh();
        }}
      >
        Save / send
      </Button>
    </div>
  );
}
