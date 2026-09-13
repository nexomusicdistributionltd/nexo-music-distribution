import "server-only";

export const PAYMENT_NOT_CONNECTED_CODE = "PAYMENT_PROVIDER_NOT_CONNECTED";

export class PaymentProviderNotConnectedError extends Error {
  readonly code = PAYMENT_NOT_CONNECTED_CODE;
  constructor(message = "Payment provider NOT CONNECTED — payout execution UNAVAILABLE.") {
    super(message);
    this.name = "PaymentProviderNotConnectedError";
  }
}

export function paymentNotConnectedMessage(): string {
  return "Payment provider NOT CONNECTED. Cannot create, status-check, or cancel live payouts.";
}

export function toPaymentErrorPayload(err: unknown): { code: string; message: string } {
  if (err instanceof PaymentProviderNotConnectedError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof Error) {
    return { code: "PAYMENT_ERROR", message: err.message };
  }
  return { code: "PAYMENT_ERROR", message: "Unknown payment error" };
}
