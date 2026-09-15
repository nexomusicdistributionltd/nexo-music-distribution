import type { DdexMessageRecord } from "./types";

/** Operator-facing ERN status. Never invents DSP Connected. */
export type DdexUiStatus = "READY" | "VALIDATED" | "NOT READY" | "FAILED" | "NOT DELIVERED";

export type DdexListSignals = {
  canGenerate?: boolean;
  latest?: Pick<DdexMessageRecord, "validation_status" | "delivery_status"> | null;
};

export function ddexUiStatus(signals: DdexListSignals): DdexUiStatus {
  const latest = signals.latest;
  if (latest) {
    if (latest.validation_status === "invalid" || latest.delivery_status === "failed") {
      return "FAILED";
    }
    if (latest.validation_status === "valid") {
      if (latest.delivery_status === "delivered" || latest.delivery_status === "acknowledged") {
        return "VALIDATED";
      }
      return "NOT DELIVERED";
    }
    if (signals.canGenerate) return "READY";
    return "NOT READY";
  }
  return signals.canGenerate ? "READY" : "NOT READY";
}

export function ddexUiStatusKind(
  status: DdexUiStatus
): "live" | "processing" | "approved" | "rejected" | "draft" | "pending" {
  switch (status) {
    case "VALIDATED":
      return "live";
    case "READY":
      return "approved";
    case "NOT DELIVERED":
      return "processing";
    case "FAILED":
      return "rejected";
    default:
      return "pending";
  }
}
