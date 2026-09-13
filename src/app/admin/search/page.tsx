import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { globalAdminSearch } from "@/lib/admin/queries";
import { parseAdminSearchEntities } from "@/lib/admin/search";

export const metadata: Metadata = {
  title: "Admin search",
  robots: { index: false, follow: false },
};

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; types?: string }>;
}) {
  await RequireAdmin();
  const sp = await searchParams;
  const entities = parseAdminSearchEntities(sp.types);
  const result = await globalAdminSearch(sp.q ?? "", entities);
  const groups = result.groups;
  const hasAny = Object.values(groups).some((g) => (g as unknown[]).length > 0);

  return (
    <div>
      <PageHeader
        title="Search"
        description="Global admin search across operational entities."
        showSearch
        searchQ={sp.q}
      />
      {!result.q ? (
        <EmptyState title="Enter a query" description="Search releases, artists, labels, users, tickets, contact, compliance." />
      ) : !hasAny ? (
        <EmptyState title="No matches" description={`Nothing found for “${result.q}”.`} />
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([kind, rows]) => {
            const list = rows as Record<string, unknown>[];
            if (!list.length) return null;
            return (
              <section key={kind}>
                <h2 className="mb-2 text-h4 capitalize">{kind}</h2>
                <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] text-small">
                  {list.map((row) => {
                    const id = String(row.id);
                    const href =
                      kind === "release"
                        ? `/admin/releases/${id}`
                        : kind === "artist"
                          ? `/admin/artists/${id}`
                          : kind === "label"
                            ? `/admin/labels/${id}`
                            : kind === "ticket"
                              ? `/admin/support?ticket=${id}`
                              : kind === "contact"
                                ? `/admin/contact`
                                : kind === "compliance"
                                  ? `/admin/compliance`
                                  : `/admin/users`;
                    const label =
                      (row.title as string) ||
                      (row.stage_name as string) ||
                      (row.artist_name as string) ||
                      (row.label_name as string) ||
                      (row.email as string) ||
                      (row.subject as string) ||
                      (row.full_name as string) ||
                      id;
                    return (
                      <li key={id} className="px-4 py-3">
                        <Link href={href} className="underline-offset-4 hover:underline">
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
