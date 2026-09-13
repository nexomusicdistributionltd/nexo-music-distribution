/** Batch 7 outbound email events — enqueue pending only. */

export const BATCH7_EMAIL_TEMPLATES = [
  "payout_requested",
  "payout_paid",
  "payout_failed",
  "payout_rejected",
  "royalty_statement_published",
  "publishing_work_update",
  "compliance_payout_hold",
] as const;

export type Batch7EmailTemplate = (typeof BATCH7_EMAIL_TEMPLATES)[number];

export function isBatch7EmailTemplate(key: string): key is Batch7EmailTemplate {
  return (BATCH7_EMAIL_TEMPLATES as readonly string[]).includes(key);
}

/** Never mark sent without provider — only pending/queued allowed from app. */
export function allowedEnqueueStatuses(): Array<"pending" | "queued"> {
  return ["pending", "queued"];
}
