"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EMAIL_AUTOMATION_SPECS } from "@/lib/email/automations";
import { getCatalogEntry } from "@/lib/email/catalog";
import { isAuthTemplateKey } from "@/lib/email/template-keys";

export type TemplateListRow = {
  key: string;
  name: string;
  category: string;
  subject: string;
  updated_at: string | null;
};

export function EmailTemplatesWorkspace({ rows }: { rows: TemplateListRow[] }) {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<"all" | "ops" | "newsletter" | "custom">("all");

  const filtered = rows.filter((row) => {
    if (category !== "all" && row.category !== category) return false;
    const hay = `${row.key} ${row.name} ${row.subject}`.toLowerCase();
    if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1 text-small">
          <span className="text-[var(--nexo-text-muted)]">Search</span>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, key, or subject"
          />
        </label>
        <label className="space-y-1 text-small">
          <span className="text-[var(--nexo-text-muted)]">Category</span>
          <select
            className="h-10 rounded-[var(--nexo-radius-sm)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-3 text-small"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            <option value="all">All</option>
            <option value="ops">Ops</option>
            <option value="newsletter">Newsletter</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      </div>
      {filtered.length === 0 ? (
        <p className="text-small text-[var(--nexo-text-muted)]">No templates match.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          <table className="min-w-full text-left text-small">
            <thead className="bg-[var(--nexo-surface)] text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Trigger</th>
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nexo-border)]">
              {filtered.map((row) => {
                const catalog = getCatalogEntry(row.key);
                const auto = EMAIL_AUTOMATION_SPECS.find((s) => s.key === row.key);
                const hosted = isAuthTemplateKey(row.key);
                return (
                  <tr key={row.key}>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-caption">{row.key}</td>
                    <td className="px-3 py-2 text-[var(--nexo-text-secondary)]">
                      {auto?.trigger ?? catalog?.eventType ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-caption">
                      {(auto?.recipientType ?? "—").replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2">
                      {hosted ? (
                        <Badge>Hosted Auth</Badge>
                      ) : catalog?.dormant ? (
                        <Badge>Dormant</Badge>
                      ) : (
                        <Badge>{row.category}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-caption">
                      {row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/emails/templates/${encodeURIComponent(row.key)}`}
                          className="text-caption underline-offset-4 hover:underline"
                        >
                          Open
                        </Link>
                        <Link
                          href={`/admin/emails/send?template=${encodeURIComponent(row.key)}`}
                          className="text-caption underline-offset-4 hover:underline"
                        >
                          Send
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
