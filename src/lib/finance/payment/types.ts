import "server-only";

export type PaymentPayoutRequest = {
  payoutId: string;
  amountMinor: number;
  currency: string;
  method?: string | null;
  destinationMask?: string | null;
  idempotencyKey?: string | null;
};

export type PaymentPayoutStatus = {
  providerPayoutId: string;
  status: "pending" | "processing" | "paid" | "failed" | "cancelled" | "unknown";
  paymentReference?: string | null;
  failureReason?: string | null;
};

export type PaymentWebhookEvent = {
  providerName: string;
  eventId: string;
  eventType: string;
  rawBody: string;
  signatureHeader: string | null;
  payload: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  readonly connected: boolean;
  createPayout(input: PaymentPayoutRequest): Promise<{ providerPayoutId: string }>;
  getPayoutStatus(providerPayoutId: string): Promise<PaymentPayoutStatus>;
  cancelPayout(providerPayoutId: string): Promise<void>;
  handlePayoutWebhook(event: PaymentWebhookEvent): Promise<{
    ok: boolean;
    mappedStatus?: string;
    payoutId?: string;
    paymentReference?: string;
    reason?: string;
  }>;
}
