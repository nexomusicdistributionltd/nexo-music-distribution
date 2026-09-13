/** Royalty import idempotency + matching helpers (no sample data). */

export type ImportRowMatchStatus =
  | "unmatched"
  | "matched"
  | "conflict"
  | "ignored"
  | "posted";

export function importIdempotencyKey(input: {
  sourceProvider: string;
  reportId: string;
  rowKey: string;
}): string {
  return `${input.sourceProvider}::${input.reportId}::${input.rowKey}`;
}

export function resolveMatchStatus(input: {
  releaseId?: string | null;
  trackId?: string | null;
  ownerUserId?: string | null;
  conflictReason?: string | null;
}): ImportRowMatchStatus {
  if (input.conflictReason) return "conflict";
  if (input.releaseId || input.trackId || input.ownerUserId) return "matched";
  return "unmatched";
}

export function validateImportRowAmounts(input: {
  amountMinor: number | null | undefined;
  currency: string | null | undefined;
}): { ok: boolean; reason?: string } {
  if (input.amountMinor == null) return { ok: true }; // allow unmatched draft rows
  if (!Number.isInteger(input.amountMinor) || input.amountMinor === 0) {
    return { ok: false, reason: "amount_minor must be nonzero integer when present" };
  }
  if (!input.currency || !/^[A-Za-z]{3}$/.test(input.currency)) {
    return { ok: false, reason: "ISO currency required with amount" };
  }
  return { ok: true };
}
