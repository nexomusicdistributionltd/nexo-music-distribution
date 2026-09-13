import "server-only";

import { readPaymentProviderConfig } from "./config";
import { NotConnectedPaymentProvider } from "./not-connected";
import type { PaymentProvider } from "./types";

export * from "./types";
export { NotConnectedPaymentProvider, isPaymentConnected } from "./not-connected";
export {
  readPaymentProviderConfig,
  getConfiguredPaymentProviderName,
  getPaymentWebhookSecret,
  isPaymentProviderConfigured,
} from "./config";
export {
  PaymentProviderNotConnectedError,
  PAYMENT_NOT_CONNECTED_CODE,
  paymentNotConnectedMessage,
  toPaymentErrorPayload,
} from "./errors";
export {
  verifyPayoutWebhookSignature,
  extractPayoutWebhookEventId,
  extractPayoutWebhookEventType,
} from "./webhook";

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  // No live adapter registered — always NotConnected (never invent success).
  void readPaymentProviderConfig();
  cached = new NotConnectedPaymentProvider();
  return cached;
}

export function getPaymentConnectionState(): {
  connected: boolean;
  providerName: string | null;
  message: string;
  webhookConfigured: boolean;
} {
  const cfg = readPaymentProviderConfig();
  return {
    connected: false,
    providerName: cfg.name,
    message: cfg.name
      ? `Payment provider "${cfg.name}" credentials may be present but no live adapter is registered. Payout execution UNAVAILABLE.`
      : "Payment provider NOT CONNECTED.",
    webhookConfigured: cfg.webhookSecretPresent,
  };
}

export function __resetPaymentProviderCacheForTests() {
  cached = null;
}
