import "server-only";

import { NotConnectedProvider, isProviderConnected } from "./not-connected";
import type { DistributionProvider } from "./types";

export * from "./types";
export { NotConnectedProvider, isProviderConnected } from "./not-connected";

let cached: DistributionProvider | null = null;

/** Returns the active distribution provider. Currently always NotConnected. */
export function getDistributionProvider(): DistributionProvider {
  if (cached) return cached;
  // When a real provider is configured, branch here. Never return fake success.
  cached = new NotConnectedProvider();
  return cached;
}

export function getProviderConnectionState(): {
  connected: boolean;
  providerName: string | null;
  message: string;
} {
  const connected = isProviderConnected();
  if (!connected) {
    return {
      connected: false,
      providerName: null,
      message: "Not connected — no distribution provider is configured.",
    };
  }
  const p = getDistributionProvider();
  return {
    connected: p.connected,
    providerName: p.name,
    message: `Connected to ${p.name}`,
  };
}
