import type { ReleaseStatus } from "@/lib/releases/types";

export type QcDecision = "approve" | "request_changes" | "reject";
export type QcPriority = "low" | "normal" | "high" | "urgent";

export const QC_CHECKLIST_KEYS = [
  "metadata_complete",
  "artwork_ok",
  "audio_ok",
  "rights_cleared",
  "territories_ok",
  "explicit_flagged",
  "isrc_upc_format",
  "no_policy_violation",
] as const;

export type QcChecklistKey = (typeof QC_CHECKLIST_KEYS)[number];
export type QcChecklist = Partial<Record<QcChecklistKey, boolean>>;

export function decisionToStatus(decision: QcDecision): ReleaseStatus {
  switch (decision) {
    case "approve":
      return "approved";
    case "request_changes":
      return "changes_requested";
    case "reject":
      return "rejected";
  }
}

export function validateQcDecision(input: {
  decision: QcDecision;
  artistVisibleReason?: string | null;
  checklist?: QcChecklist;
}): { ok: true } | { ok: false; error: string } {
  const { decision, artistVisibleReason, checklist } = input;
  if (decision === "request_changes" || decision === "reject") {
    if (!artistVisibleReason?.trim()) {
      return { ok: false, error: "Artist-visible reason is required." };
    }
  }
  if (decision === "approve") {
    const missing = QC_CHECKLIST_KEYS.filter((k) => checklist?.[k] !== true);
    if (missing.length > 0) {
      return {
        ok: false,
        error: `All checklist items must pass before approve (${missing.join(", ")}).`,
      };
    }
  }
  return { ok: true };
}

export function isQcableStatus(status: ReleaseStatus): boolean {
  return status === "submitted" || status === "in_qc";
}
