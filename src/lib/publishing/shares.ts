import { assertShareBps, validateShareBpsTotal } from "@/lib/finance/money";
import type { PublishingRightType } from "./types";

export type PublishingShareInput = {
  partyId: string;
  rightType: PublishingRightType;
  shareBps: number;
  territory?: string | null;
};

export function validatePublishingShares(shares: PublishingShareInput[]): {
  ok: boolean;
  reason?: string;
} {
  // Validate per right_type + territory group
  const groups = new Map<string, number[]>();
  for (const s of shares) {
    if (!assertShareBps(s.shareBps)) {
      return { ok: false, reason: "Invalid share_bps" };
    }
    const key = `${s.rightType}::${s.territory ?? "*"}`;
    const arr = groups.get(key) ?? [];
    arr.push(s.shareBps);
    groups.set(key, arr);
  }
  for (const [key, bps] of groups) {
    const check = validateShareBpsTotal(bps);
    if (!check.ok) {
      return { ok: false, reason: `${key}: ${check.reason}` };
    }
  }
  return { ok: true };
}
