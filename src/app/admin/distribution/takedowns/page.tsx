import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { getProviderConnectionState } from "@/lib/provider";
import { listTakedownJobs } from "@/lib/distribution/queries";
import { ReinstateButton, TakedownButton } from "@/components/distribution/DistributionActionForms";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Takedowns",
  robots: { index: false, follow: false },
};

export default async function TakedownsPage() {
  await RequireAdmin();
  const provider = await getProviderConnectionState();
  const jobs = await listTakedownJobs(50);
  const supabase = await createClient();
  const { data: live } = await supabase
    .from("releases")
    .select("id, title, primary_artist_name, status")
    .in("status", ["live", "delivered", "approved", "scheduled"])
    .order("updated_at", { ascending: false })
    .limit(15);

  return (
    <div>
      <PageHeader title="Takedowns" description="Request / reinstate. Provider call only when connected." />
      <DistributionNav current="/admin/distribution/takedowns" />
      <ProviderBanner connected={provider.connected} />

      <h2 className="mt-6 text-h4">Active takedown jobs</h2>
      {jobs.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No takedown jobs" description="Takedown-requested / taken-down jobs list here." />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {jobs.map((job) => {
            const rel = job.releases as { id?: string; title?: string; status?: string } | null;
            return (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{rel?.title || job.release_id}</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">{job.status}</p>
                </div>
                {rel?.id ? <ReinstateButton releaseId={rel.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-8 text-h4">Request takedown</h2>
      {(live ?? []).length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No eligible releases" description="Approved/delivered/live releases can be taken down." />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(live ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link href={`/admin/releases/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                  {r.title || "Untitled"}
                </Link>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {r.primary_artist_name} · {r.status}
                </p>
              </div>
              <TakedownButton releaseId={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
