import type { Metadata } from "next";
import Link from "next/link";
import { ReleaseCatalogTable } from "@/components/releases/ReleaseCatalogTable";
import { PageIntro } from "@/components/workspace/PageIntro";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { RequireRole } from "@/lib/auth/guards";
import { mapArtworkUrls } from "@/lib/releases/artwork";
import { listReleases } from "@/lib/releases/queries";
import type { ReleaseStatus } from "@/lib/releases/types";
import { RELEASE_STATUSES } from "@/lib/releases/types";
import { buildQueryHref } from "@/components/workspace/QueryPagination";
import { normalizePageNumber } from "@/lib/pagination";

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
  const sort = typeof sp.sort === "string" ? sp.sort : "updated_at";
  const order = typeof sp.order === "string" ? sp.order : "desc";
  const page = normalizePageNumber(typeof sp.page === "string" ? sp.page : undefined);

  let items: Awaited<ReturnType<typeof listReleases>>["items"] = [];
  let pageCount = 1;
  let total = 0;
  let loadError: string | null = null;

  try {
    const result = await listReleases(ctx.userId, {
      q,
      status,
      type,
      page,
      pageSize: 20,
      sort: (["created_at", "updated_at", "title", "release_date", "status"].includes(sort)
        ? sort
        : "updated_at") as "created_at" | "updated_at" | "title" | "release_date" | "status",
      order: order === "asc" ? "asc" : "desc",
    });
    items = result.items;
    pageCount = result.pageCount;
    total = result.total;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load catalog.";
  }

  const artwork = await mapArtworkUrls(items.map((r) => r.id)).catch(() => ({} as Record<string, string | null>));
  const query = { q, status, type, sort, order };

  return (
    <div className="space-y-6">
      <PageIntro
        title="Catalog"
        description={`${total} release${total === 1 ? "" : "s"}`}
        actions={
          <Link
            href="/dashboard/releases/new"
            className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
          >
            New release
          </Link>
        }
      />

      <form className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-3 sm:grid-cols-5" method="get">
        <Input name="q" placeholder="Search title or artist" defaultValue={q} aria-label="Search catalog" />
        <Select name="status" defaultValue={status} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {RELEASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <Select name="type" defaultValue={type} aria-label="Filter by type">
          <option value="all">All types</option>
          <option value="single">Single</option>
          <option value="ep">EP</option>
          <option value="album">Album</option>
        </Select>
        <Select name="sort" defaultValue={sort} aria-label="Sort">
          <option value="updated_at">Updated</option>
          <option value="release_date">Release date</option>
          <option value="title">Title</option>
          <option value="status">Status</option>
        </Select>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-[var(--nexo-radius)] border border-[var(--nexo-outline-border)] text-small font-medium"
        >
          Apply
        </button>
      </form>

      {loadError ? (
        <ErrorState title="Catalog unavailable" description={loadError} retryHref="/dashboard/releases" />
      ) : (
        <ReleaseCatalogTable
          items={items}
          artwork={artwork}
          basePath="/dashboard/releases"
          page={page}
          pageCount={pageCount}
          hrefForPage={(p) => buildQueryHref("/dashboard/releases", query, { page: p })}
          emptyTitle="No releases match"
          emptyDescription="Try clearing filters or create a new release."
          emptyAction={
            <Link
              href="/dashboard/releases/new"
              className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
            >
              New release
            </Link>
          }
          showPortalActions
        />
      )}
    </div>
  );
}
