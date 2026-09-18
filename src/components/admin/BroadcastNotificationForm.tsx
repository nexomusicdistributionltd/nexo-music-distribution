"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { sendBroadcastNotificationAction } from "@/app/admin/notifications/actions";

export function BroadcastNotificationForm() {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [audience, setAudience] = React.useState<"all" | "artists" | "labels">("all");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendBroadcastNotificationAction({ title, body, audience });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setMessage({ ok: true, text: `Broadcast delivered to ${result.count} account(s).` });
      setTitle("");
      setBody("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
      <div>
        <h2 className="text-h4">Broadcast notification</h2>
        <p className="text-caption text-[var(--nexo-text-muted)]">
          Send a realtime in-app message to Artist and Label accounts.
        </p>
      </div>
      <Input
        placeholder="Notification title"
        value={title}
        maxLength={160}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        rows={6}
        value={body}
        maxLength={20000}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Message"
        className="w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-3 py-2 text-small"
      />
      <Select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
        <option value="all">All artists & labels</option>
        <option value="artists">Artists only</option>
        <option value="labels">Labels only</option>
      </Select>
      <Button
        type="button"
        disabled={busy || !title.trim() || !body.trim()}
        onClick={() => void submit()}
      >
        {busy ? "Sending…" : "Send broadcast"}
      </Button>
      {message ? (
        <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>
      ) : null}
    </section>
  );
}
