import type { Metadata } from "next";
import Link from "next/link";
import { ReleaseRowActions } from "@/components/releases/ReleaseRowActions";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { RequireRole } from "@/lib/auth/guards";
import { listReleases } from "@/lib/releases/queries";
import type { ReleaseStatus } from "@/lib/releases/types";
import { RELEASE_STATUSES } from "@/lib/releases/types";

export const metadata: Metadata = {
  title: "Releases",
  robots: { index: false, follow: false },
};

export default async function ReleasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await RequireRole(["artist", "label"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = (typeof sp.status === "string" ? sp.status : "all") as ReleaseStatus | "all";
  const type = typeof sp.type === "string" ? sp.type : "all";
  const page = Number(typeof sp.page === "string" ? sp.page : "1") || 1;

  const { items, pageCount, total } = await listReleases(ctx.userId, {
    q,
    status,
    type,
    page,
    pageSize: 20,
    sort: "updated_at",
    order: "desc",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2">Releases</h1>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">{total} in catalog</p>
        </div>
        <Link
          href="/dashboard/releases/new"
          className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium text-[var(--nexo-primary-fg)]"
        >
          Create release
        </Link>
      </div>

      <ProviderBanner connected={false} />

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-4" method="get">
            <Input name="q" placeholder="Search title or artist" defaultValue={q} />
            <Select name="status" defaultValue={status}>
              <option value="all">All statuses</option>
              {RELEASE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
            <Select name="type" defaultValue={type}>
              <option value="all">All types</option>
              <option value="single">Single</option>
              <option value="ep">EP</option>
              <option value="album">Album</option>
            </Select>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-[var(--nexo-radius)] border border-[var(--nexo-outline-border)] text-small font-medium"
            >
              Filter
            </button>
          </form>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="No releases match"
          description="Try clearing filters or create a new release."
          action={
            <Link
              href="/dashboard/releases/new"
              className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium text-[var(--nexo-primary-fg)]"
            >
              Create release
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          <table className="w-full min-w-[720px] text-left text-small">
            <thead className="bg-[var(--nexo-elevated)] text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nexo-divider)]">
              {items.map((r) => (
                <tr key={r.id} className="bg-[var(--nexo-surface)]">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/releases/${r.id}`} className="font-medium hover:underline">
                      {r.title || "Untitled draft"}
                    </Link>
                    <p className="text-caption text-[var(--nexo-text-muted)]">{r.primary_artist_name}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{r.release_type}</td>
                  <td className="px-4 py-3">
                    <ReleaseStatusBadge status={r.status as ReleaseStatus} />
                  </td>
                  <td className="px-4 py-3 text-[var(--nexo-text-muted)]">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <ReleaseRowActions id={r.id} status={r.status as ReleaseStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={`/dashboard/releases?page=${page - 1}&q=${encodeURIComponent(q)}&status=${status}&type=${type}`}
              className="text-small underline"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-small text-[var(--nexo-text-muted)]">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={`/dashboard/releases?page=${page + 1}&q=${encodeURIComponent(q)}&status=${status}&type=${type}`}
              className="text-small underline"
            >
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
