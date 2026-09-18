import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { getProviderConnectionState } from "@/lib/provider";
import type { ReleaseStatus } from "@/lib/releases/types";
import {
  SubmitJobButton,
  SyncJobButton,
} from "@/components/distribution/DistributionActionForms";
import {
  listDeliverySnapshots,
  listDistributionJobs,
} from "@/lib/distribution/queries";
import type {
  DistributionJobRow,
  ProviderDeliverySnapshotRow,
} from "@/lib/distribution/types";
import { DeliveryRealtime } from "@/components/distribution/DeliveryRealtime";

export const metadata: Metadata = {
  title: "TooLost delivery tracker",
  robots: { index: false, follow: false },
};

type ReleaseSummary = {
  id?: string;
  title?: string;
  primary_artist_name?: string;
  status?: string;
  upc?: string | null;
  release_date?: string | null;
  provider_status?: string | null;
  provider_release_id?: string | null;
};

const formatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatTime(value: string | null | undefined): string {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatter.format(date)} UTC`;
}

function statusKey(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function providerStatusLabel(value: string | null | undefined): string {
  const key = statusKey(value);
  if (!key) return "Awaiting TooLost";
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function providerStage(value: string | null | undefined): number {
  const key = statusKey(value);
  if (key === "live" || key === "published") return 3;
  if (key === "delivered" || key === "complete" || key === "completed") return 2;
  if (
    key === "pending" ||
    key === "in_review" ||
    key === "processing" ||
    key === "submitted" ||
    key === "delivering" ||
    key === "in_delivery"
  ) {
    return 1;
  }
  return 0;
}

function badgeClass(value: string | null | undefined): string {
  const key = statusKey(value);
  if (key === "live" || key === "published") {
    return "border-[var(--nexo-success)]/30 bg-[var(--nexo-success-bg)] text-[var(--nexo-success)]";
  }
  if (key === "delivered" || key === "complete" || key === "completed") {
    return "border-[var(--nexo-accent)]/30 bg-[var(--nexo-accent)]/10 text-[var(--nexo-text)]";
  }
  if (
    key.includes("failed") ||
    key.includes("reject") ||
    key.includes("error") ||
    key === "needs_evidence"
  ) {
    return "border-[var(--nexo-error)]/30 bg-[var(--nexo-error-bg)] text-[var(--nexo-error)]";
  }
  return "border-[var(--nexo-warning)]/30 bg-[var(--nexo-warning-bg)] text-[var(--nexo-warning)]";
}

function StatusPill({ value }: { value: string | null | undefined }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-caption font-medium ${badgeClass(
        value
      )}`}
    >
      {providerStatusLabel(value)}
    </span>
  );
}

function StageRail({ status }: { status: string | null | undefined }) {
  const active = providerStage(status);
  const stages = [
    ["Pending", 1],
    ["Delivered", 2],
    ["Live", 3],
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-2">
      {stages.map(([label, step]) => (
        <div key={label} className="min-w-0">
          <div
            className={
              "h-1.5 rounded-full " +
              (active >= step
                ? "bg-[var(--nexo-accent)]"
                : "bg-[var(--nexo-border)]")
            }
          />
          <p
            className={
              "mt-1 text-caption " +
              (active >= step
                ? "font-medium text-[var(--nexo-text)]"
                : "text-[var(--nexo-text-muted)]")
            }
          >
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

function latestByRelease(
  snapshots: ProviderDeliverySnapshotRow[]
): Map<string, ProviderDeliverySnapshotRow> {
  const result = new Map<string, ProviderDeliverySnapshotRow>();
  for (const row of snapshots) {
    if (!result.has(row.release_id)) result.set(row.release_id, row);
  }
  return result;
}

export default async function DeliveryPage() {
  await RequireAdmin();
  const [provider, jobs, snapshots] = await Promise.all([
    getProviderConnectionState(),
    listDistributionJobs({ limit: 100 }),
    listDeliverySnapshots(400),
  ]);

  const latest = latestByRelease(snapshots);
  const historyByRelease = new Map<string, ProviderDeliverySnapshotRow[]>();
  for (const snapshot of snapshots) {
    const rows = historyByRelease.get(snapshot.release_id) ?? [];
    rows.push(snapshot);
    historyByRelease.set(snapshot.release_id, rows);
  }

  const trackedJobs = jobs.filter((job) =>
    !["taken_down", "cancelled"].includes(job.status)
  );

  const latestRows = trackedJobs.map((job) => latest.get(job.release_id));
  const pendingCount = latestRows.filter((row) => providerStage(row?.release_status) === 1).length;
  const deliveredCount = latestRows.filter((row) => providerStage(row?.release_status) === 2).length;
  const liveCount = latestRows.filter((row) => providerStage(row?.release_status) === 3).length;
  const attentionCount = latestRows.filter((row) => {
    const key = statusKey(row?.release_status);
    return key === "needs_evidence" || key.includes("failed") || key.includes("reject") || key.includes("error");
  }).length;

  return (
    <div>
      <DeliveryRealtime />
      <PageHeader
        title="TooLost delivery tracker"
        description="Realtime provider delivery status, store/service details and history. Nexo only shows DSP results actually returned by TooLost."
      />
      <DistributionNav current="/admin/distribution/delivery" />
      <ProviderBanner connected={provider.connected} />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Pending", pendingCount],
          ["Delivered", deliveredCount],
          ["Live", liveCount],
          ["Needs attention", attentionCount],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
          >
            <p className="text-caption text-[var(--nexo-text-muted)]">{label}</p>
            <p className="mt-1 text-h3">{value}</p>
          </div>
        ))}
      </div>

      {trackedJobs.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="No TooLost deliveries yet"
            description="Approved releases will appear here automatically after they are submitted to TooLost."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {trackedJobs.map((job: DistributionJobRow & { releases: unknown }) => {
            const release = (job.releases ?? {}) as ReleaseSummary;
            const snapshot = latest.get(job.release_id);
            const history = (historyByRelease.get(job.release_id) ?? []).slice(0, 6);
            const providerStatus =
              snapshot?.release_status ??
              release.provider_status ??
              (job.status === "submitted" ? "pending" : job.status);
            const dspRows = snapshot?.dsp_statuses ?? [];
            const providerReleaseId =
              snapshot?.provider_release_id ??
              job.provider_release_id ??
              release.provider_release_id ??
              null;

            return (
              <section
                key={job.id}
                className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/releases/${job.release_id}`}
                        className="text-h4 underline-offset-4 hover:underline"
                      >
                        {release.title || "Untitled release"}
                      </Link>
                      <StatusPill value={providerStatus} />
                    </div>
                    <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
                      {release.primary_artist_name || "Unknown artist"}
                      {release.upc ? ` · UPC ${release.upc}` : ""}
                    </p>
                    <p className="mt-1 break-all text-caption text-[var(--nexo-text-muted)]">
                      TooLost release ID: {providerReleaseId ?? "Awaiting provider ID"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {release.status ? (
                      <ReleaseStatusBadge status={release.status as ReleaseStatus} />
                    ) : null}
                    {providerReleaseId ? (
                      <SyncJobButton
                        jobId={job.id}
                        providerConnected={provider.connected}
                      />
                    ) : (
                      <SubmitJobButton
                        jobId={job.id}
                        providerConnected={provider.connected}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <StageRail status={providerStatus} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                    <p className="text-caption text-[var(--nexo-text-muted)]">TooLost status</p>
                    <p className="mt-1 text-small font-medium">{providerStatusLabel(providerStatus)}</p>
                  </div>
                  <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                    <p className="text-caption text-[var(--nexo-text-muted)]">Last provider update</p>
                    <p className="mt-1 text-small font-medium">
                      {formatTime(snapshot?.captured_at ?? job.last_sync_at ?? job.updated_at)}
                    </p>
                  </div>
                  <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                    <p className="text-caption text-[var(--nexo-text-muted)]">Source</p>
                    <p className="mt-1 text-small font-medium">
                      {snapshot?.source === "webhook"
                        ? "TooLost webhook"
                        : snapshot?.source === "api_sync"
                          ? "TooLost API sync"
                          : "Nexo submission"}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="text-small font-semibold">Store / service delivery</h3>
                      <p className="text-caption text-[var(--nexo-text-muted)]">
                        Per-DSP rows appear only when TooLost returns store-level delivery data.
                      </p>
                    </div>
                    {dspRows.length ? (
                      <span className="text-caption text-[var(--nexo-text-muted)]">
                        {dspRows.length} reported
                      </span>
                    ) : null}
                  </div>

                  {dspRows.length === 0 ? (
                    <div className="mt-3 rounded-[var(--nexo-radius)] border border-dashed border-[var(--nexo-border)] p-4 text-small text-[var(--nexo-text-muted)]">
                      No store-level rows were returned in the latest TooLost payload yet. The release-level status above is live provider data.
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {dspRows.map((row) => (
                        <div
                          key={`${row.dsp}:${row.status}`}
                          className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-small font-medium">{row.dsp}</p>
                            <StatusPill value={row.status} />
                          </div>
                          {row.message ? (
                            <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                              {row.message}
                            </p>
                          ) : null}
                          {row.updatedAt ? (
                            <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                              {formatTime(row.updatedAt)}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 border-t border-[var(--nexo-border)] pt-4">
                  <h3 className="text-small font-semibold">Recent TooLost delivery history</h3>
                  {history.length === 0 ? (
                    <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                      Waiting for the first provider status snapshot.
                    </p>
                  ) : (
                    <ol className="mt-3 space-y-2">
                      {history.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--nexo-radius)] bg-[var(--nexo-elevated)] px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <StatusPill value={row.release_status} />
                            <span className="text-caption text-[var(--nexo-text-muted)]">
                              {row.source === "webhook" ? "Webhook" : "API sync"}
                            </span>
                          </div>
                          <span className="text-caption text-[var(--nexo-text-muted)]">
                            {formatTime(row.captured_at)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {job.last_error ? (
                  <div className="mt-4 rounded-[var(--nexo-radius)] border border-[var(--nexo-error)]/30 bg-[var(--nexo-error-bg)] p-3 text-small text-[var(--nexo-error)]">
                    {job.last_error}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
