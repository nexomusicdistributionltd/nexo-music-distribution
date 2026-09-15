import type { DdexMessageRecord } from "./types";
import { acknowledgmentPatch } from "./pipeline";

export function applyDdexAcknowledgment(
  record: Pick<DdexMessageRecord, "delivery_status">,
  reference: string
) {
  if (record.delivery_status !== "delivered" && record.delivery_status !== "acknowledged") {
    throw new Error("Acknowledgment requires a delivered DDEX message (local test or real transport).");
  }
  if (!reference.trim()) {
    throw new Error("Acknowledgment reference is required.");
  }
  return acknowledgmentPatch(reference.trim());
}
