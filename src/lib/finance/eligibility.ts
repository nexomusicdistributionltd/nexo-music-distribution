export type EligibilityInput = {
  accountStatus: string;
  restrictionKind: string;
  complianceHoldActive: boolean;
  availableMinor: number;
  amountMinor: number;
  currency: string;
  minThresholdMinor: number;
  payoutsEnabled: boolean;
  method?: string | null;
};

export function evaluatePayoutEligibility(input: EligibilityInput): {
  eligible: boolean;
  reason?: string;
} {
  if (!input.payoutsEnabled) {
    return { eligible: false, reason: "Payouts temporarily disabled" };
  }
  if (input.accountStatus !== "active") {
    return { eligible: false, reason: "Account not active" };
  }
  if (input.restrictionKind === "login_restricted" || input.restrictionKind === "read_only") {
    return { eligible: false, reason: "Account restriction blocks payouts" };
  }
  if (input.complianceHoldActive) {
    return { eligible: false, reason: "Compliance hold active" };
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { eligible: false, reason: "Invalid amount" };
  }
  if (input.currency.toUpperCase() === "USD" && input.amountMinor < input.minThresholdMinor) {
    return { eligible: false, reason: "Below minimum payout threshold" };
  }
  if (input.availableMinor < input.amountMinor) {
    return { eligible: false, reason: "Insufficient available balance" };
  }
  return { eligible: true };
}
