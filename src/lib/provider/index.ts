import "server-only";

import { readProviderConfig } from "./config";
import { NotConnectedProvider } from "./not-connected";
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
  const cfg = readProviderConfig();
  if (!cfg.connected) {
    cached = new NotConnectedProvider();
    return cached;
  }
  // Real adapters register here when implemented. Until then, even with env
  // name set, refuse to pretend — require an actual adapter module.
  // No fake LIVE/DELIVERED adapter is allowed.
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
  if (!cfg.connected) {
    return {
      connected: false,
      providerName: null,
      message: "Not connected — no distribution provider is configured.",
      webhookConfigured: cfg.webhookSecretPresent,
    };
  }
  const p = getProvider();
  // Even if env looks set, adapter may still be NotConnected until real impl lands
  if (!p.connected) {
    return {
      connected: false,
      providerName: cfg.name,
      message: `Provider "${cfg.name}" credentials present but no live adapter is registered yet. Delivery remains unavailable.`,
      webhookConfigured: cfg.webhookSecretPresent,
    };
  }
  return {
    connected: true,
    providerName: p.name,
    message: `Connected to ${p.name}`,
    webhookConfigured: cfg.webhookSecretPresent,
  };
}

/** Test helper — clear cached provider instance. */
export function __resetProviderCacheForTests() {
  cached = null;
}
