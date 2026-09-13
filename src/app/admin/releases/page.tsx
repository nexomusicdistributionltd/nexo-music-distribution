import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { listAdminReleases } from "@/lib/admin/queries";
import type { ReleaseStatus } from "@/lib/releases/types";

export const metadata: Metadata = {
  title: "Admin releases",
  robots: { index: false, follow: false },
};

export default async function AdminReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await RequireAdmin();
  const sp = await searchParams;
  const status = (sp.status as ReleaseStatus | "all" | undefined) ?? "all";
  const { items, total, page, pageCount } = await listAdminReleases({
    q: sp.q,
    status,
    page: Number(sp.page || 1),
  });

  return (
    <div>
      <PageHeader
        title="Releases"
        description={`${total} release${total === 1 ? "" : "s"} in catalog.`}
        showSearch
        searchQ={sp.q}
      />
      {items.length === 0 ? (
        <EmptyState
          title="No releases found"
          description="Submitted and catalog releases will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          <table className="min-w-full text-left text-small">
            <thead className="bg-[var(--nexo-elevated)] text-caption uppercase text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Artist</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r: {
                id: string;
                title: string;
                primary_artist_name: string;
                status: ReleaseStatus;
                updated_at: string;
              }) => (
                <tr key={r.id} className="border-t border-[var(--nexo-border)]">
                  <td className="px-4 py-3">
                    <Link className="font-medium underline-offset-4 hover:underline" href={`/admin/releases/${r.id}`}>
                      {r.title || "Untitled"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--nexo-text-secondary)]">
                    {r.primary_artist_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ReleaseStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--nexo-text-muted)]">
                    {new Date(r.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-[var(--nexo-border)] px-4 py-3 text-caption text-[var(--nexo-text-muted)]">
            <span>
              Page {page} / {pageCount}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={`/admin/releases?page=${page - 1}`}>Previous</Link>
              ) : null}
              {page < pageCount ? (
                <Link href={`/admin/releases?page=${page + 1}`}>Next</Link>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
