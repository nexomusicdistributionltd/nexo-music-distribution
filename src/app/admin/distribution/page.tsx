import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getProviderConnectionState } from "@/lib/provider";
import { getDistributionOverviewCounts, listDistributionJobs } from "@/lib/distribution/queries";
import { distributionJobStatusLabel } from "@/lib/distribution/status-labels";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import type { ReleaseStatus } from "@/lib/releases/types";

export const metadata: Metadata = {
  title: "Distribution",
  robots: { index: false, follow: false },
};

export default async function DistributionHubPage() {
  await RequireAdmin();
  const provider = await getProviderConnectionState();
  const counts = await getDistributionOverviewCounts();
  const recent = await listDistributionJobs({ limit: 15 });

  const tiles = [
    { label: "Queued", value: counts.queued ?? 0, href: "/admin/distribution/queue" },
    { label: "Submitted", value: counts.submitted ?? 0, href: "/admin/distribution/submissions" },
    { label: "Live", value: counts.live ?? 0, href: "/admin/distribution/delivery" },
    { label: "Failed", value: counts.failed ?? 0, href: "/admin/distribution/failed" },
    { label: "Takedowns", value: counts.takedown_requested ?? 0, href: "/admin/distribution/takedowns" },
    { label: "Webhooks", value: counts.webhooks ?? 0, href: "/admin/distribution/webhooks" },
  ];

  return (
    <div>
      <PageHeader
        title="Distribution"
        description="Provider-independent distribution hub. No fabricated DSP delivery."
      />
      <DistributionNav current="/admin/distribution" />
      <ProviderBanner connected={provider.connected} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="transition hover:border-[var(--nexo-accent)]">
              <CardHeader>
                <CardTitle className="text-small text-[var(--nexo-text-muted)]">{t.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-h2">{t.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Provider status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-small">
          <p>
            Connected:{" "}
            <strong>{provider.connected ? "yes" : "no"}</strong>
          </p>
          <p>Provider: {provider.providerName ?? "—"}</p>
          <p>{provider.message}</p>
          <p>
            Webhook secret:{" "}
            {provider.webhookConfigured ? "configured" : "missing (webhooks fail closed)"}
          </p>
          <Link className="underline" href="/admin/distribution/provider">
            Provider details
          </Link>
        </CardContent>
      </Card>

      <h2 className="mt-8 text-h4">Recent jobs</h2>
      {recent.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No distribution jobs"
            description="Queue an approved release to create a job. Delivery requires a connected provider."
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {recent.map((job) => {
            const rel = job.releases as {
              id?: string;
              title?: string;
              primary_artist_name?: string;
              status?: string;
            } | null;
            return (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <Link
                    href={rel?.id ? `/admin/releases/${rel.id}` : "/admin/distribution/queue"}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {rel?.title || "Release"}
                  </Link>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {rel?.primary_artist_name ?? "—"} · job {distributionJobStatusLabel(job.status)}
                    {job.last_error ? ` · ${job.last_error}` : ""}
                  </p>
                </div>
                {rel?.status ? (
                  <ReleaseStatusBadge status={rel.status as ReleaseStatus} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
