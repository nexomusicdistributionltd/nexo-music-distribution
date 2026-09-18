export const PAYOUT_METHOD_TYPES = [
  "bank_transfer",
  "paypal",
  "payoneer",
  "mobile_money",
  "other",
] as const;

export type PayoutMethodType = (typeof PAYOUT_METHOD_TYPES)[number];

export type PayoutMethodStatus = "active" | "disabled" | "verification_required";

export function isPayoutMethodType(value: string): value is PayoutMethodType {
  return (PAYOUT_METHOD_TYPES as readonly string[]).includes(value);
}

export function payoutMethodLabel(value: string): string {
  const labels: Record<string, string> = {
    bank_transfer: "Bank transfer",
    paypal: "PayPal",
    payoneer: "Payoneer",
    mobile_money: "Mobile money",
    other: "Other",
  };
  return labels[value] ?? value.replace(/_/g, " ");
}

export function maskPayoutDestination(value: string): string {
  const clean = value.trim();
  if (!clean) return "Secure destination";
  if (clean.includes("@")) {
    const [name, domain] = clean.split("@");
    return `${name.slice(0, 2)}***@${domain || "***"}`;
  }
  const compact = clean.replace(/\s+/g, "");
  if (compact.length <= 4) return "••••";
  return `•••• ${compact.slice(-4)}`;
}

export function normalizeCountryCode(value: string | null | undefined): string | null {
  const clean = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(clean) ? clean : null;
}

export function normalizeCurrency(value: string | null | undefined): string | null {
  const clean = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(clean) ? clean : null;
}
