import type { ReleaseStatus } from "@/lib/releases/types";

/** Artist/admin-facing labels (no internal QC jargon leakage beyond QC Review). */
const LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_qc: "QC Review",
  changes_requested: "Declined",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Queued for distribution",
  delivering: "Distributing",
  delivered: "Delivered",
  live: "Live",
  failed: "Failed",
  takedown_requested: "Takedown requested",
  taken_down: "Taken down",
};

/** Artist-safe subset — no credentials / internal notes. */
export function artistStatusLabel(status: ReleaseStatus | string): string {
  return LABELS[status] ?? String(status).replace(/_/g, " ");
}

export function adminStatusLabel(status: ReleaseStatus | string): string {
  return artistStatusLabel(status);
}

export function distributionJobStatusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: "Queued",
    submitting: "Submitting",
    submitted: "Submitted to provider",
    syncing: "Syncing",
    delivered: "Delivered",
    live: "Live",
    failed: "Failed",
    cancelled: "Cancelled",
    takedown_requested: "Takedown requested",
    taken_down: "Taken down",
    reinstating: "Reinstating",
  };
  return map[status] ?? status.replace(/_/g, " ");
}
