import type { ReactNode } from "react";
import Link from "next/link";
import { CoverArt } from "@/components/workspace/CoverArt";
import { QueryPagination } from "@/components/workspace/QueryPagination";
import { ReleaseRowActions } from "@/components/releases/ReleaseRowActions";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { ReleaseRow, ReleaseStatus } from "@/lib/releases/types";

export function ReleaseCatalogTable({
  items,
  artwork,
  basePath,
  page,
  pageCount,
  hrefForPage,
  emptyTitle = "No releases",
  emptyDescription,
  emptyAction,
  showPortalActions = false,
}: {
  items: Array<
    Pick<
      ReleaseRow,
      | "id"
      | "title"
      | "primary_artist_name"
      | "release_type"
      | "upc"
      | "release_date"
      | "status"
      | "updated_at"
    >
  >;
  artwork: Record<string, string | null>;
  basePath: string;
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  showPortalActions?: boolean;
}) {
  if (!items.length) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );
  }

  return (
    <div>
      <Table>
        <THead>
          <TR>
            <TH>Release</TH>
            <TH>Artist</TH>
            <TH>Type</TH>
            <TH>UPC</TH>
            <TH>Date</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {items.map((r) => (
            <TR key={r.id}>
              <TD>
                <Link
                  href={`${basePath}/${r.id}`}
                  className="flex items-center gap-3 font-medium text-[var(--nexo-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
                >
                  <CoverArt src={artwork[r.id]} title={r.title || "Untitled"} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate">{r.title || "Untitled draft"}</span>
                    <span className="block text-caption font-normal text-[var(--nexo-text-muted)] lg:hidden">
                      {r.primary_artist_name}
                    </span>
                  </span>
                </Link>
              </TD>
              <TD className="hidden sm:table-cell">{r.primary_artist_name || "—"}</TD>
              <TD className="capitalize">{r.release_type}</TD>
              <TD className="font-mono text-caption">{r.upc || "—"}</TD>
              <TD className="whitespace-nowrap text-[var(--nexo-text-muted)]">
                {r.release_date || new Date(r.updated_at).toLocaleDateString()}
              </TD>
              <TD>
                <ReleaseStatusBadge status={r.status as ReleaseStatus} />
              </TD>
              <TD className="text-right">
                {showPortalActions ? (
                  <ReleaseRowActions id={r.id} status={r.status as ReleaseStatus} />
                ) : (
                  <Link
                    href={`${basePath}/${r.id}`}
                    className="text-caption underline-offset-4 hover:underline"
                  >
                    Open
                  </Link>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <QueryPagination page={page} pageCount={pageCount} hrefForPage={hrefForPage} className="px-1" />
    </div>
  );
}
