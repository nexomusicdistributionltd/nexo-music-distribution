import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { listAuditLogs } from "@/lib/admin/queries";
import { normalizePageNumber } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Audit log",
  robots: { index: false, follow: false },
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; from?: string; to?: string; action?: string }>;
}) {
  await RequireAdmin();
  const sp = await searchParams;
  const page = normalizePageNumber(sp.page);
  const { items, total, pageCount } = await listAuditLogs({
    page,
    fromDate: sp.from,
    toDate: sp.to,
    action: sp.action,
  });

  if (total > 0 && page > pageCount) {
    const params = new URLSearchParams();
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (sp.action) params.set("action", sp.action);
    if (pageCount > 1) params.set("page", String(pageCount));
    redirect(params.size ? `/admin/audit?${params.toString()}` : "/admin/audit");
  }

  return (
    <div>
      <PageHeader
        title="Audit"
        description={`${total} immutable operational audit events (no secrets).`}
      />
      <form className="mb-4 flex flex-wrap gap-2 text-small" method="get">
        <label>
          From{" "}
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="rounded border border-[var(--nexo-border)] bg-transparent px-2 py-1"
          />
        </label>
        <label>
          To{" "}
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="rounded border border-[var(--nexo-border)] bg-transparent px-2 py-1"
          />
        </label>
        <button type="submit" className="underline-offset-4 hover:underline">
          Filter
        </button>
      </form>
      {items.length === 0 ? (
        <EmptyState title="No audit events yet" />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] text-small">
          {items.map((row: {
            id: string;
            action: string;
            entity_type: string;
            entity_id: string | null;
            created_at: string;
            actor_user_id: string | null;
          }) => (
            <li key={row.id} className="px-4 py-3">
              <p className="font-medium">{row.action}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {row.entity_type} {row.entity_id ?? ""} ·{" "}
                {new Date(row.created_at).toLocaleString()} · actor{" "}
                {row.actor_user_id ?? "system"}
              </p>
            </li>
          ))}
        </ul>
      )}
      {pageCount > 1 ? (
        <div className="mt-3 flex justify-between text-caption text-[var(--nexo-text-muted)]">
          <span>
            Page {page} / {pageCount}
          </span>
          <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={`/admin/audit?page=${page - 1}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`}
            >
              Previous
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link
              href={`/admin/audit?page=${page + 1}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`}
            >
              Next
            </Link>
          ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
