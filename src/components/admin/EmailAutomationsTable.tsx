"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { toggleEmailAutomationAction } from "@/app/admin/emails/actions";

export type AutomationRow = {
  key: string;
  catalogKey: string | null;
  name: string;
  trigger: string;
  recipientType: string;
  enabled: boolean;
  dormant: boolean;
  hostedBySupabase: boolean;
  updatedAt: string | null;
};

export function EmailAutomationsTable({ rows }: { rows: AutomationRow[] }) {
  const [pending, start] = useTransition();

  return (
    <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
      <table className="min-w-full text-left text-small">
        <thead className="bg-[var(--nexo-surface)] text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
          <tr>
            <th className="px-3 py-2">Automation</th>
            <th className="px-3 py-2">Catalog key</th>
            <th className="px-3 py-2">Trigger</th>
            <th className="px-3 py-2">Recipient</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Updated</th>
            <th className="px-3 py-2">Enabled</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--nexo-border)]">
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2 font-mono text-caption">
                {row.catalogKey ?? "—"}
              </td>
              <td className="px-3 py-2 text-[var(--nexo-text-secondary)]">{row.trigger}</td>
              <td className="px-3 py-2 text-caption">{row.recipientType.replace(/_/g, " ")}</td>
              <td className="px-3 py-2">
                {row.hostedBySupabase ? (
                  <Badge>Hosted Auth</Badge>
                ) : row.dormant ? (
                  <Badge>Dormant</Badge>
                ) : row.enabled ? (
                  <Badge>Active</Badge>
                ) : (
                  <Badge>Off</Badge>
                )}
              </td>
              <td className="px-3 py-2 text-caption">
                {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
              </td>
              <td className="px-3 py-2">
                {row.hostedBySupabase ? (
                  <span className="text-caption text-[var(--nexo-text-muted)]">Supabase</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded border border-[var(--nexo-border)] px-2 py-1 text-caption hover:bg-[var(--nexo-surface)] disabled:opacity-50"
                    onClick={() =>
                      start(async () => {
                        await toggleEmailAutomationAction(row.key, !row.enabled);
                      })
                    }
                  >
                    {row.enabled ? "Disable" : "Enable"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
