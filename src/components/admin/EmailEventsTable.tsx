"use client";

import { useTransition } from "react";
import { retryEmailEventAction } from "@/app/admin/emails/actions";
import type { OutboundListItem } from "@/lib/email/outbound-meta";

export type EmailEventListItem = OutboundListItem;

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [u, d] = email.split("@");
  if (!d) return "***";
  const user = u.length <= 2 ? "*" : u[0] + "***" + u[u.length - 1];
  return `${user}@${d}`;
}

export function EmailEventsTable({ events }: { events: EmailEventListItem[] }) {
  const [pending, start] = useTransition();

  if (events.length === 0) {
    return (
      <p className="text-small text-[var(--nexo-text-secondary)]">
        No email events yet. Events are enqueued into email_outbound_events after successful RPCs; SENT only after a real provider accept.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
      <table className="min-w-full text-left text-small">
        <thead className="bg-[var(--nexo-surface)] text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
          <tr>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Template</th>
            <th className="px-3 py-2">Recipient</th>
            <th className="px-3 py-2">Release</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Sent</th>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Error</th>
            <th className="px-3 py-2">Retry</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--nexo-border)]">
          {events.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2 font-mono text-caption">{e.event_type}</td>
              <td className="px-3 py-2 font-mono text-caption">{e.template_key}</td>
              <td className="px-3 py-2">{maskEmail(e.recipient_email)}</td>
              <td className="px-3 py-2 font-mono text-caption">
                {e.related_release_id ? e.related_release_id.slice(0, 8) : "—"}
              </td>
              <td className="px-3 py-2">{e.status}</td>
              <td className="px-3 py-2 text-caption">
                {new Date(e.created_at).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-caption">
                {e.sent_at ? new Date(e.sent_at).toLocaleString() : "—"}
              </td>
              <td className="px-3 py-2 text-caption">
                {e.provider ?? "—"}
                {e.provider_message_id ? ` · ${e.provider_message_id.slice(0, 10)}` : ""}
              </td>
              <td className="max-w-[12rem] truncate px-3 py-2 text-caption text-[var(--nexo-text-secondary)]">
                {e.error ?? "—"}
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded border border-[var(--nexo-border)] px-2 py-1 text-caption hover:bg-[var(--nexo-surface)] disabled:opacity-50"
                  onClick={() =>
                    start(async () => {
                      await retryEmailEventAction(e.id);
                    })
                  }
                >
                  Retry
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
