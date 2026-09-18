import { afterEach, describe, expect, it } from "vitest";
import {
  getConfiguredProviderName,
  isDistributionProviderConfigured,
  readProviderConfig,
} from "./config";
import { __resetProviderCacheForTests, getProvider, getProviderConnectionState } from "./index";

describe("provider config", () => {
  const keys = [
    "PROVIDER_NAME",
    "PROVIDER_API_KEY",
    "PROVIDER_API_BASE_URL",
    "PROVIDER_WEBHOOK_SECRET",
    "DISTRIBUTION_API_BASE_URL",
    "DISTRIBUTION_AUTHORIZE_URL",
    "DISTRIBUTION_TOKEN_URL",
    "DISTRIBUTION_CLIENT_ID",
    "DISTRIBUTION_CLIENT_SECRET",
    "DISTRIBUTION_OAUTH_STATE_SECRET",
    "DISTRIBUTION_TOKEN_ENCRYPTION_KEY",
  ];
  const backup: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (k in backup) {
        if (backup[k] === undefined) delete process.env[k];
        else process.env[k] = backup[k];
      }
    }
    __resetProviderCacheForTests();
  });

  function setEnv(map: Record<string, string | undefined>) {
    for (const [k, v] of Object.entries(map)) {
      backup[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    __resetProviderCacheForTests();
  }

  it("reports not connected when env unset", async () => {
    setEnv({
      PROVIDER_NAME: undefined,
      PROVIDER_API_KEY: undefined,
      PROVIDER_WEBHOOK_SECRET: undefined,
      DISTRIBUTION_API_BASE_URL: undefined,
      DISTRIBUTION_AUTHORIZE_URL: undefined,
      DISTRIBUTION_TOKEN_URL: undefined,
      DISTRIBUTION_CLIENT_ID: undefined,
      DISTRIBUTION_CLIENT_SECRET: undefined,
      DISTRIBUTION_OAUTH_STATE_SECRET: undefined,
      DISTRIBUTION_TOKEN_ENCRYPTION_KEY: undefined,
    });
    expect(isDistributionProviderConfigured()).toBe(false);
    expect(getConfiguredProviderName()).toBeNull();
    const cfg = readProviderConfig();
    expect(cfg.connected).toBe(false);
    expect(cfg.name).toBe("not_connected");
    const p = getProvider();
    expect(p.connected).toBe(false);
    expect((await getProviderConnectionState()).connected).toBe(false);
  });

  it("does not claim connected without both name and api key", () => {
    setEnv({ PROVIDER_NAME: "fuga", PROVIDER_API_KEY: undefined });
    expect(isDistributionProviderConfigured()).toBe(false);
  });

  it("still returns NotConnected adapter until real adapter registered", async () => {
    setEnv({
      PROVIDER_NAME: "fuga",
      PROVIDER_API_KEY: "secret-test",
      DISTRIBUTION_API_BASE_URL: undefined,
      DISTRIBUTION_AUTHORIZE_URL: undefined,
      DISTRIBUTION_TOKEN_URL: undefined,
      DISTRIBUTION_CLIENT_ID: undefined,
      DISTRIBUTION_CLIENT_SECRET: undefined,
      DISTRIBUTION_OAUTH_STATE_SECRET: undefined,
      DISTRIBUTION_TOKEN_ENCRYPTION_KEY: undefined,
    });
    expect(isDistributionProviderConfigured()).toBe(true);
    const p = getProvider();
    // No live adapter registered — factory refuses fake success
    expect(p.connected).toBe(false);
    expect((await getProviderConnectionState()).connected).toBe(false);
  });
});
