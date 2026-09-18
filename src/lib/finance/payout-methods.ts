export const PAYOUT_METHOD_TYPES = [
  "bank_transfer",
  "paypal",
  "payoneer",
  "wise",
  "mobile_money",
  "stripe",
  "rthyms",
  "other",
] as const;

export type PayoutMethodType = (typeof PAYOUT_METHOD_TYPES)[number];

export function isPayoutMethodType(value: string): value is PayoutMethodType {
  return (PAYOUT_METHOD_TYPES as readonly string[]).includes(value);
}

export function payoutMethodLabel(value: string): string {
  const labels: Record<string, string> = {
    bank_transfer: "Bank transfer",
    paypal: "PayPal",
    payoneer: "Payoneer",
    wise: "Wise",
    mobile_money: "Mobile money",
    stripe: "Stripe",
    rthyms: "Rthyms",
    other: "Other",
  };
  return labels[value] ?? value.replace(/_/g, " ");
}

export function maskDestination(value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  if (clean.includes("@")) {
    const [name, domain] = clean.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  const visible = clean.replace(/\s+/g, "");
  return visible.length <= 4 ? "••••" : `•••• ${visible.slice(-4)}`;
}
