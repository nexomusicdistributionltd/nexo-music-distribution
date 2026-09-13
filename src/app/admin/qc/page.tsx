import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { listQcQueue } from "@/lib/admin/queries";
import { QcQueueActions } from "@/components/admin/QcQueueActions";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";

export const metadata: Metadata = {
  title: "QC queue",
  robots: { index: false, follow: false },
};

export default async function QcQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    assigned?: string;
    page?: string;
  }>;
}) {
  const ctx = await RequireAdmin();
  const sp = await searchParams;
  const assigned =
    sp.assigned === "me" || sp.assigned === "unassigned" || sp.assigned === "all"
      ? sp.assigned
      : "all";
  const { items, total, page } = await listQcQueue({
    status: sp.status,
    priority: sp.priority,
    assigned,
    userId: ctx.userId,
    page: Number(sp.page || 1),
  });

  return (
    <div>
      <PageHeader
        title="QC work queue"
        description="Claim items, set priority, and review releases. Race-safe claim via database lock."
      />
      <div className="mb-4 flex flex-wrap gap-2 text-small">
        {[
          ["all", "All open"],
          ["queued", "Queued"],
          ["claimed", "Claimed"],
          ["in_review", "In review"],
        ].map(([v, label]) => (
          <Link
            key={v}
            href={`/admin/qc?status=${v}`}
            className="rounded-full border border-[var(--nexo-border)] px-3 py-1 hover:bg-[var(--nexo-ghost-hover)]"
          >
            {label}
          </Link>
        ))}
        <Link
          href="/admin/qc?assigned=unassigned"
          className="rounded-full border border-[var(--nexo-border)] px-3 py-1"
        >
          Unassigned
        </Link>
        <Link
          href="/admin/qc?assigned=me"
          className="rounded-full border border-[var(--nexo-border)] px-3 py-1"
        >
          Mine
        </Link>
        {["urgent", "high", "normal", "low"].map((priority) => (
          <Link
            key={priority}
            href={`/admin/qc?priority=${priority}`}
            className="rounded-full border border-[var(--nexo-border)] px-3 py-1 capitalize"
          >
            {priority}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="QC queue empty"
          description="When releases are submitted, they appear here for review."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-caption text-[var(--nexo-text-muted)]">
            {total} item(s) · page {page}
          </p>
          <QcQueueActions items={items.map((i: { id: string }) => i.id)} />
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {items.map((item: {
              id: string;
              priority: string;
              status: string;
              assigned_to: string | null;
              release_id: string;
              releases: {
                title: string;
                primary_artist_name: string;
                status: string;
                submitted_at: string | null;
              } | null;
            }) => (
              <li key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link
                    href={`/admin/releases/${item.release_id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {item.releases?.title || "Untitled"}
                  </Link>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {item.releases?.primary_artist_name || "—"} · priority {item.priority} ·{" "}
                    {item.status}
                    {item.assigned_to ? " · assigned" : " · unassigned"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {item.releases?.status ? (
                    <ReleaseStatusBadge status={item.releases.status as never} />
                  ) : null}
                  <QcQueueActions items={[item.id]} single />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
