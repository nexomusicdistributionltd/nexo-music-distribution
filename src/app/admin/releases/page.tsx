import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { ReleaseCatalogTable } from "@/components/releases/ReleaseCatalogTable";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { listAdminReleases } from "@/lib/admin/queries";
import { mapArtworkUrls } from "@/lib/releases/artwork";
import type { ReleaseStatus } from "@/lib/releases/types";
import { RELEASE_STATUSES } from "@/lib/releases/types";
import { buildQueryHref } from "@/components/workspace/QueryPagination";
import { normalizePageNumber } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Admin releases",
  robots: { index: false, follow: false },
};

export default async function AdminReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; from?: string; to?: string }>;
}) {
  await RequireAdmin();
  const sp = await searchParams;
  const status = (sp.status as ReleaseStatus | "all" | undefined) ?? "all";
  const page = normalizePageNumber(sp.page);
  let items: Awaited<ReturnType<typeof listAdminReleases>>["items"] = [];
  let total = 0;
  let pageCount = 1;
  let loadError: string | null = null;

  try {
    const result = await listAdminReleases({
      q: sp.q,
      status,
      page,
      fromDate: sp.from,
      toDate: sp.to,
    });
    items = result.items;
    total = result.total;
    pageCount = result.pageCount;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load releases.";
  }

  const artwork = await mapArtworkUrls(items.map((r: { id: string }) => r.id)).catch(
    () => ({} as Record<string, string | null>)
  );
  const query = { q: sp.q, status, from: sp.from, to: sp.to };

  return (
    <div className="space-y-6">
      <PageIntro title="Catalog" description={`${total} release${total === 1 ? "" : "s"}`} />
      <form className="flex flex-wrap items-end gap-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-3 text-small" method="get">
        <Input name="q" placeholder="Search title or artist" defaultValue={sp.q ?? ""} className="max-w-xs" aria-label="Search releases" />
        <Select name="status" defaultValue={status} className="max-w-[12rem]" aria-label="Status">
          <option value="all">All statuses</option>
          {RELEASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <label className="text-caption text-[var(--nexo-text-muted)]">
          From
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="ml-2 h-10 rounded-[var(--nexo-radius)] border border-[var(--nexo-input-border)] bg-[var(--nexo-input-bg)] px-2" />
        </label>
        <label className="text-caption text-[var(--nexo-text-muted)]">
          To
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="ml-2 h-10 rounded-[var(--nexo-radius)] border border-[var(--nexo-input-border)] bg-[var(--nexo-input-bg)] px-2" />
        </label>
        <button type="submit" className="h-10 rounded-[var(--nexo-radius)] border border-[var(--nexo-outline-border)] px-4 font-medium">
          Apply
        </button>
      </form>
      {loadError ? (
        <ErrorState title="Catalog unavailable" description={loadError} retryHref="/admin/releases" />
      ) : (
        <ReleaseCatalogTable
          items={items}
          artwork={artwork}
          basePath="/admin/releases"
          page={page}
          pageCount={pageCount}
          hrefForPage={(p) => buildQueryHref("/admin/releases", query, { page: p })}
          emptyTitle="No releases found"
          emptyDescription="Submitted and catalog releases will appear here."
        />
      )}
    </div>
  );
}
