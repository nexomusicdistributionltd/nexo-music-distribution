import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { getProviderConnectionState } from "@/lib/provider";
import { createClient } from "@/lib/supabase/server";
import type { ReleaseStatus } from "@/lib/releases/types";
import { SubmitJobButton, SyncJobButton } from "@/components/distribution/DistributionActionForms";
import { listDistributionJobs } from "@/lib/distribution/queries";

export const metadata: Metadata = {
  title: "Delivery",
  robots: { index: false, follow: false },
};

export default async function DeliveryPage() {
  await RequireAdmin();
  const provider = await getProviderConnectionState();
  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("id, title, primary_artist_name, status, provider_release_id, provider_connected")
    .in("status", ["delivering", "delivered", "live", "scheduled"])
    .order("updated_at", { ascending: false })
    .limit(50);
  const jobs = await listDistributionJobs({ limit: 50 });
  const jobByRelease = new Map(jobs.map((j) => [j.release_id, j]));

  return (
    <div>
      <PageHeader
        title="Delivery"
        description="Internal delivery statuses only. LIVE/DELIVERED require real provider events."
      />
      <DistributionNav current="/admin/distribution/delivery" />
      <ProviderBanner connected={provider.connected} />
      {(data ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nothing in delivery"
            description="No scheduled/delivering/delivered/live releases. Provider connection required for delivery."
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(data ?? []).map((r) => {
            const job = jobByRelease.get(r.id);
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link href={`/admin/releases/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                    {r.title || "Untitled"}
                  </Link>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {r.primary_artist_name}
                    {r.provider_release_id ? ` · ${r.provider_release_id}` : " · no provider id"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ReleaseStatusBadge status={r.status as ReleaseStatus} />
                  {job ? (
                    r.provider_release_id || job.provider_release_id ? (
                      <SyncJobButton jobId={job.id} providerConnected={provider.connected} />
                    ) : (
                      <SubmitJobButton jobId={job.id} providerConnected={provider.connected} />
                    )
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
