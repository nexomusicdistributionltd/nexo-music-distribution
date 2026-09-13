import "server-only";

/**
 * Payment provider config — server-only secrets.
 * Never invent a connected state.
 */
export type PaymentProviderConfig = {
  name: string | null;
  apiKeyPresent: boolean;
  webhookSecretPresent: boolean;
  connected: boolean;
};

export function readPaymentProviderConfig(): PaymentProviderConfig {
  const name = process.env.PAYMENT_PROVIDER_NAME?.trim() || null;
  const apiKeyPresent = Boolean(process.env.PAYMENT_PROVIDER_API_KEY?.trim());
  const webhookSecretPresent = Boolean(process.env.PAYMENT_WEBHOOK_SECRET?.trim());
  // Even with env present, no live adapter is registered yet → not connected.
  return {
    name,
    apiKeyPresent,
    webhookSecretPresent,
    connected: false,
  };
}

export function isPaymentProviderConfigured(): boolean {
  const cfg = readPaymentProviderConfig();
  return Boolean(cfg.name && cfg.apiKeyPresent);
}

export function getPaymentWebhookSecret(): string {
  return process.env.PAYMENT_WEBHOOK_SECRET?.trim() || "";
}

export function getConfiguredPaymentProviderName(): string | null {
  return readPaymentProviderConfig().name;
}
