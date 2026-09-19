import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { QueryPagination } from "@/components/workspace/QueryPagination";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { listQcQueue } from "@/lib/admin/queries";
import { adminListErrorMessage } from "@/lib/db/admin-query";
import { QcQueueActions } from "@/components/admin/QcQueueActions";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { cn } from "@/lib/utils";
import { normalizePageNumber } from "@/lib/pagination";

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
  const { items, total, page, error: loadError } = await listQcQueue({
    status: sp.status,
    priority: sp.priority,
    assigned,
    userId: ctx.userId,
    page: normalizePageNumber(sp.page),
  });
  const pageCount = Math.max(1, Math.ceil(total / 25));
  if (!loadError && total > 0 && page > pageCount) {
    const params = new URLSearchParams();
    if (sp.status) params.set("status", sp.status);
    if (sp.priority) params.set("priority", sp.priority);
    if (assigned !== "all") params.set("assigned", assigned);
    if (pageCount > 1) params.set("page", String(pageCount));
    redirect(params.size ? `/admin/qc?${params.toString()}` : "/admin/qc");
  }

  const chips: Array<[string, string, boolean]> = [
    ["/admin/qc?status=all", "All open", !sp.status || sp.status === "all"],
    ["/admin/qc?status=queued", "Queued", sp.status === "queued"],
    ["/admin/qc?status=claimed", "Claimed", sp.status === "claimed"],
    ["/admin/qc?status=in_review", "In review", sp.status === "in_review"],
    ["/admin/qc?assigned=unassigned", "Unassigned", assigned === "unassigned"],
    ["/admin/qc?assigned=me", "Mine", assigned === "me"],
  ];

  return (
    <div className="space-y-6">
      <PageIntro
        title="QC queue"
        description="Claim, prioritize, approve, reject, or request changes. Hidden nav is not authorization — this page still requires staff roles."
      />
      <div className="flex flex-wrap gap-2 text-small">
        {chips.map(([href, label, active]) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-full border px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]",
              active
                ? "border-[var(--nexo-text)] bg-[var(--nexo-elevated)]"
                : "border-[var(--nexo-border)] hover:bg-[var(--nexo-ghost-hover)]"
            )}
          >
            {label}
          </Link>
        ))}
        {["urgent", "high", "normal", "low"].map((priority) => (
          <Link
            key={priority}
            href={`/admin/qc?priority=${priority}`}
            className={cn(
              "rounded-full border px-3 py-1 capitalize",
              sp.priority === priority
                ? "border-[var(--nexo-text)] bg-[var(--nexo-elevated)]"
                : "border-[var(--nexo-border)] hover:bg-[var(--nexo-ghost-hover)]"
            )}
          >
            {priority}
          </Link>
        ))}
      </div>
      {loadError ? (
        <ErrorState
          title="QC queue unavailable"
          description={adminListErrorMessage({ message: loadError })}
          retryHref="/admin/qc"
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="QC queue empty"
          description="When releases are submitted, they appear here for review."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-caption text-[var(--nexo-text-muted)]">
              {total} item{total === 1 ? "" : "s"}
              {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
            </p>
            <QcQueueActions items={items.map((i: { id: string }) => i.id)} />
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Release</TH>
                <TH>Artist</TH>
                <TH>Priority</TH>
                <TH>Queue</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
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
                } | null;
              }) => (
                <TR key={item.id}>
                  <TD>
                    <Link
                      href={`/admin/releases/${item.release_id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {item.releases?.title || "Untitled"}
                    </Link>
                  </TD>
                  <TD>{item.releases?.primary_artist_name || "—"}</TD>
                  <TD className="capitalize">{item.priority}</TD>
                  <TD>
                    {item.status}
                    {item.assigned_to ? " · assigned" : " · unassigned"}
                  </TD>
                  <TD>
                    {item.releases?.status ? (
                      <ReleaseStatusBadge status={item.releases.status as never} />
                    ) : null}
                  </TD>
                  <TD>
                    <QcQueueActions items={[item.id]} single />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <QueryPagination
            page={page}
            pageCount={pageCount}
            hrefForPage={(p) => {
              const params = new URLSearchParams();
              if (sp.status) params.set("status", sp.status);
              if (sp.priority) params.set("priority", sp.priority);
              if (assigned !== "all") params.set("assigned", assigned);
              params.set("page", String(p));
              return `/admin/qc?${params.toString()}`;
            }}
          />
        </div>
      )}
    </div>
  );
}
