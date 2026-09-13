import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { getProviderConnectionState } from "@/lib/provider";
import { listFailedJobs } from "@/lib/distribution/queries";
import { RetryJobButton } from "@/components/distribution/DistributionActionForms";

export const metadata: Metadata = {
  title: "Failed + Retry",
  robots: { index: false, follow: false },
};

export default async function FailedPage() {
  await RequireAdmin();
  const provider = getProviderConnectionState();
  const jobs = await listFailedJobs(50);

  return (
    <div>
      <PageHeader title="Failed + Retry" description="Failed distribution jobs with truthful errors." />
      <DistributionNav current="/admin/distribution/failed" />
      <ProviderBanner connected={provider.connected} />
      {jobs.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No failed jobs" description="Failures from submit/sync appear here." />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {jobs.map((job) => {
            const rel = job.releases as { title?: string } | null;
            return (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{rel?.title || job.release_id}</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    retries {job.retry_count}/{job.max_retries}
                    {job.last_error ? ` · ${job.last_error}` : ""}
                  </p>
                </div>
                <RetryJobButton jobId={job.id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
