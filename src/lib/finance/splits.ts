import { assertShareBps, validateShareBpsTotal } from "./money";

export type SplitPartyRole =
  | "artist"
  | "label"
  | "producer"
  | "songwriter"
  | "featured"
  | "publisher"
  | "other";

export type SplitShareInput = {
  partyName: string;
  partyRole: SplitPartyRole;
  shareBps: number;
  partyUserId?: string | null;
  payeeId?: string | null;
};

export function validateSplitShares(shares: SplitShareInput[]): {
  ok: boolean;
  reason?: string;
  totalBps: number;
} {
  if (shares.length === 0) {
    return { ok: false, reason: "At least one share required.", totalBps: 0 };
  }
  for (const s of shares) {
    if (!s.partyName?.trim()) {
      return { ok: false, reason: "Party name required.", totalBps: 0 };
    }
    if (!assertShareBps(s.shareBps)) {
      return { ok: false, reason: `Invalid share_bps for ${s.partyName}.`, totalBps: 0 };
    }
  }
  const check = validateShareBpsTotal(shares.map((s) => s.shareBps));
  if (!check.ok) return { ok: false, reason: check.reason, totalBps: check.total };
  return { ok: true, totalBps: check.total };
}

/** Allocate integer minor units by bps without float drift; remainder to first party. */
export function allocateByBps(amountMinor: number, shares: { shareBps: number }[]): number[] {
  if (!Number.isInteger(amountMinor)) {
    throw new Error("amountMinor must be integer");
  }
  const totalBps = shares.reduce((a, s) => a + s.shareBps, 0);
  if (totalBps <= 0 || totalBps > 10000) {
    throw new Error("Invalid share total");
  }
  const raw = shares.map((s) => Math.trunc((amountMinor * s.shareBps) / totalBps));
  const allocated = raw.reduce((a, b) => a + b, 0);
  let remainder = amountMinor - allocated;
  const out = [...raw];
  let i = 0;
  while (remainder !== 0 && out.length > 0) {
    const step = remainder > 0 ? 1 : -1;
    out[i % out.length] += step;
    remainder -= step;
    i += 1;
  }
  return out;
}

export function effectiveRuleApplies(input: {
  effectiveFrom: string;
  effectiveTo: string | null;
  asOf: string;
}): boolean {
  const asOf = input.asOf.slice(0, 10);
  if (asOf < input.effectiveFrom.slice(0, 10)) return false;
  if (input.effectiveTo && asOf > input.effectiveTo.slice(0, 10)) return false;
  return true;
}
