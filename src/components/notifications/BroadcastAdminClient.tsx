"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import {
  createNotificationBroadcastAction,
  publishNotificationBroadcastAction,
} from "@/app/admin/notifications/actions";

export function BroadcastAdminClient({
  broadcasts,
}: {
  broadcasts: Array<{
    id: string;
    title: string;
    body: string;
    audience: string;
    created_at: string;
    published_at: string | null;
    recipient_count: number;
  }>;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-6">
      <form
        className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          start(async () => {
            setError(null);
            setMessage(null);
            const result = await createNotificationBroadcastAction({
              title: String(fd.get("title") || ""),
              body: String(fd.get("body") || ""),
              audience: String(fd.get("audience") || "all") as "all" | "artists" | "labels",
              publishNow: true,
            });
            if (!result.ok) setError(result.error);
            else {
              setMessage(`Broadcast published to ${result.data.recipientCount} account(s).`);
              form.reset();
              router.refresh();
            }
          });
        }}
      >
        <h2 className="text-h4">Send broadcast notification</h2>
        <Input name="title" required maxLength={160} placeholder="Notification title" />
        <Textarea name="body" required maxLength={20000} placeholder="Full message" rows={7} />
        <Select name="audience" defaultValue="all">
          <option value="all">All Artist & Label accounts</option>
          <option value="artists">Artists only</option>
          <option value="labels">Labels only</option>
        </Select>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {message ? <Alert variant="success">{message}</Alert> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Publishing…" : "Publish broadcast"}
        </Button>
      </form>

      {broadcasts.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-h4">Broadcast history</h2>
          <ul className="space-y-2">
            {broadcasts.map((row) => (
              <li
                key={row.id}
                className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{row.title}</p>
                    <p className="mt-1 line-clamp-2 text-caption text-[var(--nexo-text-muted)]">{row.body}</p>
                    <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                      Audience {row.audience} · created {new Date(row.created_at).toLocaleString()}
                      {row.published_at
                        ? ` · published to ${row.recipient_count} account(s)`
                        : " · draft"}
                    </p>
                  </div>
                  {!row.published_at ? (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const result = await publishNotificationBroadcastAction(row.id);
                          if (!result.ok) setError(result.error);
                          else {
                            setMessage(`Published to ${result.data.recipientCount} account(s).`);
                            router.refresh();
                          }
                        })
                      }
                    >
                      Publish
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
