/** Integer minor units + ISO 4217 currency helpers. Never use floats for money. */

export type IsoCurrency = string; // ISO 4217, e.g. USD

export function assertMinorUnits(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isInteger(amount) && amount !== 0;
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

export type PayoutStatus =
  | "pending"
  | "approved"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "on_hold";

const PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ["approved", "cancelled", "on_hold"],
  approved: ["processing", "cancelled", "on_hold"],
  processing: ["paid", "failed", "on_hold"],
  on_hold: ["pending", "approved", "cancelled"],
  failed: ["pending", "cancelled"],
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
}): { ok: boolean; reason?: string } {
  if (!input.paymentReference?.trim()) {
    return { ok: false, reason: "payment_reference required." };
  }
  if (!input.paidAt) {
    return { ok: false, reason: "paid_at required." };
  }
  return { ok: true };
}
