export type ReleaseType = "single" | "ep" | "album";

export type ReleaseStatus =
  | "draft"
  | "submitted"
  | "in_qc"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "scheduled"
  | "delivering"
  | "delivered"
  | "live"
  | "takedown_requested"
  | "taken_down"
  | "failed";

export type ContributorRole =
  | "primary_artist"
  | "featured_artist"
  | "remixer"
  | "producer"
  | "songwriter"
  | "composer"
  | "lyricist"
  | "mixer"
  | "engineer"
  | "publisher"
  | "other";

export type AssetKind = "audio" | "artwork" | "other";

export type NotificationType =
  | "release_submitted"
  | "release_status_changed"
  | "qc_changes_requested"
  | "qc_approved"
  | "qc_rejected"
  | "release_live"
  | "takedown_update"
  | "system"
  | "provider_not_connected"
  | "distribution_update"
  | "distribution_failed"
  | "catalog_migration_update"
  | "broadcast";

export interface ReleaseRow {
  id: string;
  owner_user_id: string;
  artist_profile_id: string | null;
  label_profile_id: string | null;
  release_type: ReleaseType;
  title: string;
  version: string | null;
  primary_artist_name: string;
  genre: string | null;
  subgenre: string | null;
  language: string | null;
  release_date: string | null;
  original_release_date: string | null;
  label_name: string | null;
  copyright_year: number | null;
  copyright_line: string | null;
  phonogram_line: string | null;
  upc: string | null;
  explicit: boolean;
  description: string | null;
  territories: string[];
  distribution_settings: Record<string, unknown>;
  status: ReleaseStatus;
  locked_at: string | null;
  submitted_at: string | null;
  rejection_reason: string | null;
  changes_requested_reason: string | null;
  provider_name: string | null;
  provider_release_id: string | null;
  provider_status: string | null;
  provider_metadata: Record<string, unknown>;
  provider_connected: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReleaseTrackRow {
  id: string;
  release_id: string;
  track_number: number;
  title: string;
  version: string | null;
  isrc: string | null;
  duration_ms: number | null;
  explicit: boolean;
  language: string | null;
  lyrics: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleaseContributorRow {
  id: string;
  release_id: string;
  track_id: string | null;
  name: string;
  role: ContributorRole;
  /** Optional ownership/share metadata only. NOT a DDEX DisplayArtist %. */
  share_percent: number | null;
  ipi_cae: string | null;
  isni: string | null;
  created_at: string;
}

export interface ReleaseAssetRow {
  id: string;
  release_id: string;
  track_id: string | null;
  kind: AssetKind;
  storage_bucket: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number | null;
  checksum: string | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  container: string | null;
  sample_rate_hz: number | null;
  bit_depth: number | null;
  channels: number | null;
  duration_ms: number | null;
  hash_algorithm: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface ReleaseStatusHistoryRow {
  id: string;
  release_id: string;
  previous_status: ReleaseStatus | null;
  new_status: ReleaseStatus;
  actor_user_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export const RELEASE_STATUSES: ReleaseStatus[] = [
  "draft",
  "submitted",
  "in_qc",
  "changes_requested",
  "approved",
  "rejected",
  "scheduled",
  "delivering",
  "delivered",
  "live",
  "failed",
  "takedown_requested",
  "taken_down",
];

export const EDITABLE_STATUSES: ReleaseStatus[] = ["draft", "changes_requested"];

export const LOCKED_STATUSES: ReleaseStatus[] = [
  "submitted",
  "in_qc",
  "approved",
  "rejected",
  "scheduled",
  "delivering",
  "delivered",
  "live",
  "failed",
  "takedown_requested",
  "taken_down",
];

export const PROVIDER_GATED_STATUSES: ReleaseStatus[] = [
  "delivering",
  "delivered",
  "live",
];

export const STAFF_ONLY_STATUSES: ReleaseStatus[] = [
  "in_qc",
  "approved",
  "rejected",
  "scheduled",
  "delivering",
  "delivered",
  "live",
  "taken_down",
];

export function statusLabel(status: ReleaseStatus): string {
  // Prefer shared Batch 6 labels (QC Review, Queued for distribution, Distributing, …)
  const labels: Record<ReleaseStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    in_qc: "QC Review",
    changes_requested: "Changes requested",
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
  return labels[status] ?? status.replace(/_/g, " ");
}

export function statusKind(
  status: ReleaseStatus
): "live" | "processing" | "approved" | "rejected" | "draft" | "pending" {
  switch (status) {
    case "live":
    case "delivered":
      return "live";
    case "approved":
    case "scheduled":
      return "approved";
    case "rejected":
    case "taken_down":
    case "failed":
      return "rejected";
    case "draft":
      return "draft";
    case "submitted":
    case "in_qc":
    case "changes_requested":
    case "takedown_requested":
      return "pending";
    case "delivering":
      return "processing";
    default:
      return "draft";
  }
}
