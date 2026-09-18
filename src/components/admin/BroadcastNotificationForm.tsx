"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { sendBroadcastNotificationAction } from "@/app/admin/notifications/actions";

export function BroadcastNotificationForm() {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [audience, setAudience] = React.useState<"all" | "artists" | "labels">("all");
  const [actionPath, setActionPath] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendBroadcastNotificationAction({ title, body, audience, actionPath });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(`Broadcast delivered to ${result.count} account(s).`);
      setTitle("");
      setBody("");
      setActionPath("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
      <div>
        <h2 className="text-h4">Broadcast notification</h2>
        <p className="text-caption text-[var(--nexo-text-muted)]">Fan out a realtime in-app message to all artist/label accounts or a selected audience.</p>
      </div>
      <Input placeholder="Notification title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        rows={6}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Full broadcast message"
        className="w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-3 py-2 text-small"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
          <option value="all">All artists & labels</option>
          <option value="artists">Artists only</option>
          <option value="labels">Labels only</option>
        </Select>
        <Input placeholder="Optional internal action path, e.g. /earnings" value={actionPath} onChange={(e) => setActionPath(e.target.value)} />
      </div>
      <Button type="button" disabled={busy || !title.trim() || !body.trim()} onClick={() => void submit()}>
        {busy ? "Sending…" : "Send broadcast"}
      </Button>
      {message ? <p className="text-small text-[var(--nexo-text-muted)]">{message}</p> : null}
    </section>
  );
}
