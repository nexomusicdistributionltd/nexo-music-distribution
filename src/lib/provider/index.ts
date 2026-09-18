import "server-only";

import { readProviderConfig } from "./config";
import { NotConnectedProvider } from "./not-connected";
import { DistributionEngineProvider } from "./distribution-engine";
import { isDistributionOAuthConfigured } from "./oauth/config";
import { hasDistributionCredential } from "./oauth/store";
import { getStoredDistributionIdentityHealth } from "./oauth/client";
import type { DistributionProvider } from "./types";
import { hasProviderWebhookSigningSecret } from "./webhook-secret";

export * from "./types";
export { NotConnectedProvider, isProviderConnected } from "./not-connected";
export {
  readProviderConfig,
  getConfiguredProviderName,
  getProviderWebhookSecret,
  isDistributionProviderConfigured,
} from "./config";
export {
  providerNotConnectedMessage,
  PROVIDER_NOT_CONNECTED_CODE,
  toProviderErrorPayload,
} from "./errors";

let cached: DistributionProvider | null = null;

/**
 * Factory: returns NotConnected when unset; pluggable real adapter when
 * PROVIDER_NAME + PROVIDER_API_KEY are present (adapter registry).
 * Never invents success.
 */
export function getProvider(): DistributionProvider {
  if (cached) return cached;
  if (isDistributionOAuthConfigured()) {
    cached = new DistributionEngineProvider();
    return cached;
  }
  cached = new NotConnectedProvider();
  return cached;
}

/** Alias used by Batch 4 call sites. */
export function getDistributionProvider(): DistributionProvider {
  return getProvider();
}

export async function getProviderConnectionState(): Promise<{
  connected: boolean;
  providerName: string | null;
  message: string;
  webhookConfigured: boolean;
}> {
  const cfg = readProviderConfig();
  const webhookConfigured =
    cfg.webhookSecretPresent || (await hasProviderWebhookSigningSecret());

  if (isDistributionOAuthConfigured()) {
    const authorized = await hasDistributionCredential();
    if (!authorized) {
      return {
        connected: false,
        providerName: "distribution_engine",
        message: "Distribution Engine is configured and ready for secure authorization.",
        webhookConfigured,
      };
    }
    const health = await getStoredDistributionIdentityHealth();
    return {
      connected: health.ok,
      providerName: "distribution_engine",
      message: health.message,
      webhookConfigured,
    };
  }

  return {
    connected: false,
    providerName: null,
    message: "Distribution Engine is not configured.",
    webhookConfigured,
  };
}

/** Test helper — clear cached provider instance. */
export function __resetProviderCacheForTests() {
  cached = null;
}
