export type DistributionJobStatus =
  | "queued"
  | "submitting"
  | "submitted"
  | "syncing"
  | "delivered"
  | "live"
  | "failed"
  | "cancelled"
  | "takedown_requested"
  | "taken_down"
  | "reinstating";

export type ProviderSubmissionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "failed"
  | "superseded";

export type WebhookProcessStatus =
  | "received"
  | "processed"
  | "ignored"
  | "failed"
  | "duplicate";

export interface DistributionJobRow {
  id: string;
  release_id: string;
  provider_name: string;
  status: DistributionJobStatus;
  priority: number;
  queued_at: string;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  last_sync_at: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  last_error: string | null;
  provider_release_id: string | null;
  provider_track_ids: Record<string, unknown>;
  response_ref: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderSubmissionRow {
  id: string;
  job_id: string;
  release_id: string;
  provider_name: string;
  attempt_number: number;
  status: ProviderSubmissionStatus;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown> | null;
  response_ref: string | null;
  provider_release_id: string | null;
  error_code: string | null;
  error_message: string | null;
  idempotency_key: string;
  created_at: string;
  completed_at: string | null;
}

export interface ProviderWebhookEventRow {
  id: string;
  provider_name: string;
  event_id: string;
  event_type: string;
  signature_valid: boolean | null;
  process_status: WebhookProcessStatus;
  payload: Record<string, unknown>;
  release_id: string | null;
  job_id: string | null;
  mapped_status: string | null;
  error_message: string | null;
  received_at: string;
  processed_at: string | null;
}

export interface ProviderDeliverySnapshotRow {
  id: string;
  job_id: string | null;
  release_id: string;
  provider_name: string;
  provider_release_id: string | null;
  release_status: string;
  dsp_statuses: Array<{
    dsp: string;
    status: string;
    message?: string;
    updatedAt?: string;
  }>;
  source: "api_sync" | "webhook";
  event_id: string | null;
  captured_at: string;
}

/** Safe provider → internal status mapping (never invents live without signal). */
export const SAFE_WEBHOOK_STATUS_MAP: Record<string, string> = {
  pending: "delivering",
  in_review: "delivering",
  processing: "delivering",
  delivering: "delivering",
  in_delivery: "delivering",
  submitted: "delivering",
  delivered: "delivered",
  complete: "delivered",
  live: "live",
  published: "live",
  failed: "failed",
  error: "failed",
  rejected: "failed",
  takedown_requested: "takedown_requested",
  taken_down: "taken_down",
  takedown: "taken_down",
};

export function mapProviderStatusToRelease(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return SAFE_WEBHOOK_STATUS_MAP[key] ?? null;
}
