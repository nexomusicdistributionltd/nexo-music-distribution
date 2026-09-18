import "server-only";

import { readProviderConfig } from "./config";
import { NotConnectedProvider } from "./not-connected";
import { DistributionEngineProvider } from "./distribution-engine";
import { isDistributionOAuthConfigured } from "./oauth/config";
import type { DistributionProvider } from "./types";

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

export function getProviderConnectionState(): {
  connected: boolean;
  providerName: string | null;
  message: string;
  webhookConfigured: boolean;
} {
  const cfg = readProviderConfig();

  if (isDistributionOAuthConfigured()) {
    const p = getProvider();
    return {
      connected: p.connected,
      providerName: "distribution_engine",
      message: p.connected
        ? "Distribution Engine configured. Authorization is verified at request time."
        : "Distribution Engine unavailable.",
      webhookConfigured: cfg.webhookSecretPresent,
    };
  }

  return {
    connected: false,
    providerName: null,
    message: "Distribution Engine is not configured.",
    webhookConfigured: cfg.webhookSecretPresent,
  };
}

/** Test helper — clear cached provider instance. */
export function __resetProviderCacheForTests() {
  cached = null;
}
