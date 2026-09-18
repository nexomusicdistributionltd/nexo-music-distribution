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
      ? `Manual Nexo payout processing is available. Automated ${cfg.name} execution will activate only after its live adapter is verified.`
      : "Manual Nexo payout processing is available. Automated provider settlement is not enabled yet.",
    webhookConfigured: cfg.webhookSecretPresent,
  };
}

export function __resetPaymentProviderCacheForTests() {
  cached = null;
}
