import "server-only";

/**
 * Server-only provider configuration.
 * Credentials never ship to the client. Missing config ⇒ NotConnected.
 */

export type ProviderConfig = {
  name: string;
  connected: boolean;
  apiBaseUrl: string | null;
  apiKeyPresent: boolean;
  webhookSecretPresent: boolean;
};

function trim(v: string | undefined): string {
  return (v ?? "").trim();
}

/** Active provider name from env (e.g. PROVIDER_NAME=fuga). Empty ⇒ not_connected. */
export function getConfiguredProviderName(): string | null {
  const name = trim(process.env.PROVIDER_NAME);
  return name.length > 0 ? name.toLowerCase() : null;
}

export function getProviderApiKey(): string | null {
  const key = trim(process.env.PROVIDER_API_KEY);
  return key.length > 0 ? key : null;
}

export function getProviderApiBaseUrl(): string | null {
  const url = trim(process.env.PROVIDER_API_BASE_URL);
  return url.length > 0 ? url : null;
}

export function getProviderWebhookSecret(): string | null {
  const secret = trim(process.env.PROVIDER_WEBHOOK_SECRET);
  return secret.length > 0 ? secret : null;
}

export function readProviderConfig(): ProviderConfig {
  const name = getConfiguredProviderName();
  const apiKeyPresent = Boolean(getProviderApiKey());
  const apiBaseUrl = getProviderApiBaseUrl();
  const webhookSecretPresent = Boolean(getProviderWebhookSecret());
  const connected = Boolean(name && apiKeyPresent);
  return {
    name: connected && name ? name : "not_connected",
    connected,
    apiBaseUrl,
    apiKeyPresent,
    webhookSecretPresent,
  };
}

export function isDistributionProviderConfigured(): boolean {
  return readProviderConfig().connected;
}
