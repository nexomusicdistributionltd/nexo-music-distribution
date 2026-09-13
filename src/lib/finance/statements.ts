import type { MoneyEntryKind } from "./money";

export type StatementTotals = {
  opening_minor: number;
  earnings_minor: number;
  deductions_minor: number;
  adjustments_minor: number;
  payouts_minor: number;
  closing_minor: number;
};

export function computeStatementTotals(input: {
  openingMinor: number;
  entries: { kind: MoneyEntryKind; amount_minor: number }[];
}): StatementTotals {
  let earnings = 0;
  let deductions = 0;
  let adjustments = 0;
  let payouts = 0;
  for (const e of input.entries) {
    switch (e.kind) {
      case "royalty_credit":
      case "royalty_debit":
        earnings += e.amount_minor;
        break;
      case "deduction":
      case "fee":
        deductions += e.amount_minor;
        break;
      case "adjustment":
      case "reversal":
      case "refund":
        adjustments += e.amount_minor;
        break;
      case "payout":
        payouts += e.amount_minor;
        break;
    }
  }
  const closing = input.openingMinor + earnings + deductions + adjustments + payouts;
  return {
    opening_minor: input.openingMinor,
    earnings_minor: earnings,
    deductions_minor: deductions,
    adjustments_minor: adjustments,
    payouts_minor: payouts,
    closing_minor: closing,
  };
}
