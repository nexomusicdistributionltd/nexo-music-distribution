import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { getProviderConnectionState } from "@/lib/provider";
import { listDistributionJobs } from "@/lib/distribution/queries";
import { distributionJobStatusLabel } from "@/lib/distribution/status-labels";
import {
  SubmitJobButton,
  SyncJobButton,
} from "@/components/distribution/DistributionActionForms";
import { createClient } from "@/lib/supabase/server";
import { QueueReleaseButton } from "@/components/distribution/DistributionActionForms";

export const metadata: Metadata = {
  title: "Distribution queue",
  robots: { index: false, follow: false },
};

export default async function QueuePage() {
  await RequireAdmin();
  const provider = await getProviderConnectionState();
  const jobs = await listDistributionJobs({ status: "queued", limit: 50 });
  const supabase = await createClient();
  const { data: approved } = await supabase
    .from("releases")
    .select("id, title, primary_artist_name, status")
    .in("status", ["approved", "failed"])
    .order("updated_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <PageHeader title="Queue" description="Approved → queued for distribution. Submit requires a real provider." />
      <DistributionNav current="/admin/distribution/queue" />
      <ProviderBanner connected={provider.connected} />

      <h2 className="mt-6 text-h4">Approved / failed — ready to queue</h2>
      {(approved ?? []).length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No approved releases waiting" description="QC-approved releases appear here." />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(approved ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link href={`/admin/releases/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                  {r.title || "Untitled"}
                </Link>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {r.primary_artist_name} · {r.status}
                </p>
              </div>
              <QueueReleaseButton releaseId={r.id} />
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-h4">Queued jobs</h2>
      {jobs.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="Queue empty" description="No queued distribution jobs." />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {jobs.map((job) => {
            const rel = job.releases as { id?: string; title?: string; primary_artist_name?: string } | null;
            return (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{rel?.title || job.release_id}</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {distributionJobStatusLabel(job.status)} · retries {job.retry_count}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SubmitJobButton jobId={job.id} providerConnected={provider.connected} />
                  <SyncJobButton jobId={job.id} providerConnected={provider.connected} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
