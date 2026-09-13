import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { searchDistribution } from "@/lib/distribution/queries";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import type { ReleaseStatus } from "@/lib/releases/types";

export const metadata: Metadata = {
  title: "Distribution search",
  robots: { index: false, follow: false },
};

export default async function DistSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await RequireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const results = q ? await searchDistribution(q) : { releases: [], jobs: [] };

  return (
    <div>
      <PageHeader title="Distribution search" description="Search releases and jobs by title, UPC, provider id." />
      <DistributionNav current="/admin/distribution/search" />
      <form className="mt-4 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Title, artist, UPC, provider id…" className="max-w-md" />
        <button
          type="submit"
          className="rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 py-2 text-small [color:var(--nexo-primary-fg)]"
        >
          Search
        </button>
      </form>

      {!q ? (
        <div className="mt-4">
          <EmptyState title="Enter a query" description="Results stay empty until you search." />
        </div>
      ) : results.releases.length === 0 && results.jobs.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No matches" description="Nothing matched that query." />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div>
            <h2 className="text-h4">Releases</h2>
            <ul className="mt-2 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
              {results.releases.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <Link href={`/admin/releases/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                    {r.title}
                  </Link>
                  <ReleaseStatusBadge status={r.status as ReleaseStatus} />
                </li>
              ))}
            </ul>
          </div>
          {results.jobs.length > 0 ? (
            <div>
              <h2 className="text-h4">Jobs</h2>
              <ul className="mt-2 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
                {results.jobs.map((j) => (
                  <li key={j.id} className="px-4 py-3 text-small">
                    {j.id} · {j.status}
                    {j.provider_release_id ? ` · ${j.provider_release_id}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
