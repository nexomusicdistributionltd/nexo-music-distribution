/** Integer minor units + ISO 4217 currency helpers. Never use floats for money. */

export type IsoCurrency = string; // ISO 4217, e.g. USD

export function assertMinorUnits(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isInteger(amount) && amount !== 0;
}

export function assertNonNegativeMinorUnits(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isInteger(amount) && amount >= 0;
}

export function isIsoCurrency(code: unknown): code is string {
  return typeof code === "string" && /^[A-Z]{3}$/.test(code.toUpperCase());
}

export function normalizeCurrency(code: string): string {
  return code.trim().toUpperCase();
}

export function formatMinorUnits(amountMinor: number, currency: IsoCurrency): string {
  const code = currency.toUpperCase();
  const fraction = currencyFractionDigits(code);
  const major = amountMinor / 10 ** fraction;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    }).format(major);
  } catch {
    return `${major.toFixed(fraction)} ${code}`;
  }
}

export function currencyFractionDigits(currency: string): number {
  const zero = new Set(["JPY", "KRW", "VND"]);
  if (zero.has(currency.toUpperCase())) return 0;
  return 2;
}

export function parseMajorUnitsToMinor(value: string | number, currency: string): number | null {
  const raw = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
  const fraction = currencyFractionDigits(currency);
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [wholeRaw, fracRaw = ""] = unsigned.split(".");
  if (fracRaw.length > fraction) return null;
  const whole = BigInt(wholeRaw || "0");
  const frac = BigInt((fracRaw + "0".repeat(fraction)).slice(0, fraction) || "0");
  const scale = BigInt(10 ** fraction);
  let minor = whole * scale + frac;
  if (negative) minor = -minor;
  const asNumber = Number(minor);
  return Number.isSafeInteger(asNumber) ? asNumber : null;
}

/** Basis points: 10000 = 100% */
export function assertShareBps(bps: unknown): bps is number {
  return typeof bps === "number" && Number.isInteger(bps) && bps >= 0 && bps <= 10000;
}

export function validateShareBpsTotal(shares: number[]): { ok: boolean; total: number; reason?: string } {
  const total = shares.reduce((a, b) => a + b, 0);
  if (total > 10000) {
    return { ok: false, total, reason: `Shares exceed 100% (${total} bps)` };
  }
  return { ok: true, total };
}

export type PayoutStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "on_hold"
  | "rejected";

const PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ["under_review", "approved", "cancelled", "on_hold", "rejected"],
  under_review: ["approved", "rejected", "cancelled", "on_hold", "pending"],
  approved: ["processing", "cancelled", "on_hold", "rejected"],
  processing: ["paid", "failed", "on_hold", "rejected"],
  on_hold: ["pending", "under_review", "approved", "cancelled", "rejected"],
  failed: ["pending", "cancelled", "under_review"],
  rejected: ["pending"],
  cancelled: [],
  paid: [],
};

export function allowedPayoutTransitions(from: PayoutStatus): PayoutStatus[] {
  return PAYOUT_TRANSITIONS[from] ?? [];
}

export function canTransitionPayout(from: PayoutStatus, to: PayoutStatus): {
  ok: boolean;
  reason?: string;
} {
  if (from === to) return { ok: false, reason: "Status unchanged." };
  if (to === "paid") {
    return {
      ok: false,
      reason: "PAID requires a real payment operation (payment_reference + paid_at).",
    };
  }
  if (!allowedPayoutTransitions(from).includes(to)) {
    return { ok: false, reason: `Cannot move payout from ${from} to ${to}.` };
  }
  return { ok: true };
}

/** Explicit payment op gate — still blocked unless reference present. */
export function canSetPaidWithPaymentOp(input: {
  paymentReference: string | null | undefined;
  paidAt: string | null | undefined;
  fromStatus?: PayoutStatus;
}): { ok: boolean; reason?: string } {
  if (input.fromStatus && input.fromStatus !== "processing") {
    return { ok: false, reason: "PAID only allowed from PROCESSING." };
  }
  if (!input.paymentReference?.trim()) {
    return { ok: false, reason: "payment_reference required." };
  }
  if (!input.paidAt) {
    return { ok: false, reason: "paid_at required." };
  }
  return { ok: true };
}

export type MoneyEntryKind =
  | "royalty_credit"
  | "royalty_debit"
  | "adjustment"
  | "fee"
  | "payout"
  | "reversal"
  | "deduction"
  | "refund";

export type TransactionKind =
  | "ROYALTY"
  | "ADJUSTMENT"
  | "DEDUCTION"
  | "FEE"
  | "PAYOUT"
  | "REFUND";

export function toTransactionKind(kind: MoneyEntryKind): TransactionKind {
  switch (kind) {
    case "royalty_credit":
    case "royalty_debit":
      return "ROYALTY";
    case "adjustment":
    case "reversal":
      return "ADJUSTMENT";
    case "deduction":
      return "DEDUCTION";
    case "fee":
      return "FEE";
    case "payout":
      return "PAYOUT";
    case "refund":
      return "REFUND";
    default:
      return "ADJUSTMENT";
  }
}

export type BalanceBucket = "available" | "pending" | "paid" | "held";

export type LedgerBalances = {
  available_minor: number;
  pending_minor: number;
  paid_minor: number;
  held_minor: number;
  total_minor: number;
  currency: string;
};

/** Empty/unavailable — never invent $0 as earnings unless truly calculated from ledger. */
export function emptyBalancesMessage(hasLedgerRows: boolean): string {
  if (!hasLedgerRows) {
    return "No financial data available yet. Balances are derived from the royalty ledger when imports or adjustments are recorded.";
  }
  return "Balances calculated from ledger entries.";
}

/** No silent FX — caller must refuse when rate missing. */
export function convertMinorUnitsWithRate(input: {
  amountMinor: number;
  rate: number | null | undefined;
}): { ok: true; amountMinor: number } | { ok: false; reason: string } {
  if (input.rate == null || !(input.rate > 0) || !Number.isFinite(input.rate)) {
    return { ok: false, reason: "FX rate UNAVAILABLE — no silent conversion." };
  }
  // Keep integer minor units via rounding; still requires explicit rate.
  const converted = Math.round(input.amountMinor * input.rate);
  if (!Number.isInteger(converted)) {
    return { ok: false, reason: "Conversion did not yield integer minor units." };
  }
  return { ok: true, amountMinor: converted };
}
