import type { LedgerBalances } from "./money";

export function deriveBalancesFromEntries(
  entries: { amount_minor: number; balance_bucket: string; currency: string }[],
  currency: string
): LedgerBalances {
  const filtered = entries.filter((e) => e.currency.toUpperCase() === currency.toUpperCase());
  const sum = (bucket: string) =>
    filtered
      .filter((e) => e.balance_bucket === bucket)
      .reduce((a, e) => a + e.amount_minor, 0);

  return {
    currency: currency.toUpperCase(),
    available_minor: sum("available"),
    pending_minor: sum("pending"),
    paid_minor: sum("paid"),
    held_minor: sum("held"),
    total_minor: filtered.reduce((a, e) => a + e.amount_minor, 0),
  };
}

export function isNegativeBalanceAllowed(input: {
  recoupmentModelEnabled: boolean;
  availableMinor: number;
}): boolean {
  if (input.availableMinor >= 0) return true;
  return input.recoupmentModelEnabled === true;
}
