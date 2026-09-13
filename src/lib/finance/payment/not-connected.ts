import "server-only";

import { PaymentProviderNotConnectedError } from "./errors";
import { isPaymentProviderConfigured } from "./config";
import type {
  PaymentProvider,
  PaymentPayoutRequest,
  PaymentPayoutStatus,
  PaymentWebhookEvent,
} from "./types";

export class NotConnectedPaymentProvider implements PaymentProvider {
  readonly name = "not_connected";
  readonly connected = false;

  private fail(): never {
    throw new PaymentProviderNotConnectedError();
  }

  async createPayout(input: PaymentPayoutRequest): Promise<{ providerPayoutId: string }> {
    void input;
    this.fail();
  }

  async getPayoutStatus(providerPayoutId: string): Promise<PaymentPayoutStatus> {
    void providerPayoutId;
    this.fail();
  }

  async cancelPayout(providerPayoutId: string): Promise<void> {
    void providerPayoutId;
    this.fail();
  }

  async handlePayoutWebhook(event: PaymentWebhookEvent): Promise<{
    ok: boolean;
    mappedStatus?: string;
    payoutId?: string;
    paymentReference?: string;
    reason?: string;
  }> {
    void event;
    return {
      ok: false,
      reason: "Payment provider NOT CONNECTED — webhook cannot be applied to live payouts.",
    };
  }
}

export function isPaymentConnected(): boolean {
  return isPaymentProviderConfigured() && false; // no live adapter registered
}
