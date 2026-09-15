import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Paddle } from "@paddle/paddle-js";
import {
  MISSING_PADDLE_CLIENT_TOKEN_DEV_MESSAGE,
  MISSING_PADDLE_CLIENT_TOKEN_USER_MESSAGE,
  __resetPaddleBrowserClientForTests,
  getPaddleBrowserClient,
  openPaddleOverlayCheckout,
  resolvePaddleJsInit,
  warnIfPaddleClientTokenMissing,
} from "./paddle.client";

afterEach(() => {
  __resetPaddleBrowserClientForTests();
  vi.restoreAllMocks();
});

describe("Paddle.js client token wiring", () => {
  it("does not throw when NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing", () => {
    expect(() =>
      resolvePaddleJsInit({
        environment: "production",
        env: { PADDLE_ENVIRONMENT: "production" } as NodeJS.ProcessEnv,
      })
    ).not.toThrow();
    const result = resolvePaddleJsInit({
      environment: "production",
      env: {} as NodeJS.ProcessEnv,
      token: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing_token");
      expect(result.error).toBe(MISSING_PADDLE_CLIENT_TOKEN_USER_MESSAGE);
    }
  });

  it("logs a clear console error in development when the token is missing", () => {
    const logger = { error: vi.fn() };
    const result = resolvePaddleJsInit({
      environment: "production",
      env: {} as NodeJS.ProcessEnv,
      token: null,
    });
    warnIfPaddleClientTokenMissing(result, { nodeEnv: "development", logger });
    expect(logger.error).toHaveBeenCalledWith(MISSING_PADDLE_CLIENT_TOKEN_DEV_MESSAGE);
  });

  it("does not log the missing-token error in production", () => {
    const logger = { error: vi.fn() };
    const result = resolvePaddleJsInit({
      environment: "sandbox",
      env: {} as NodeJS.ProcessEnv,
    });
    warnIfPaddleClientTokenMissing(result, { nodeEnv: "production", logger });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("matches PADDLE_ENVIRONMENT production|sandbox and never silently defaults", () => {
    const live = resolvePaddleJsInit({
      environment: "production",
      token: "live_public_client_token_placeholder",
    });
    expect(live).toEqual({
      ok: true,
      token: "live_public_client_token_placeholder",
      environment: "production",
    });
    const sandbox = resolvePaddleJsInit({
      environment: "sandbox",
      env: { NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_public_client_token" } as NodeJS.ProcessEnv,
    });
    expect(sandbox).toMatchObject({ ok: true, environment: "sandbox", token: "test_public_client_token" });
    const missingEnv = resolvePaddleJsInit({
      environment: null,
      token: "live_public_client_token_placeholder",
    });
    expect(missingEnv.ok).toBe(false);
    if (!missingEnv.ok) expect(missingEnv.code).toBe("missing_environment");
  });

  it("does not call initializePaddle when the public token is missing", async () => {
    const initialize = vi.fn();
    const result = await getPaddleBrowserClient({
      environment: "production",
      env: {} as NodeJS.ProcessEnv,
      token: "",
      initialize,
    });
    expect(initialize).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(MISSING_PADDLE_CLIENT_TOKEN_USER_MESSAGE);
  });

  it("initializes Paddle.js with the public token and matching environment", async () => {
    const paddle = { Checkout: { open: vi.fn() }, PricePreview: vi.fn() } as unknown as Paddle;
    const initialize = vi.fn().mockResolvedValue(paddle);
    const result = await getPaddleBrowserClient({
      environment: "production",
      token: "live_nexo_client_token",
      initialize,
    });
    expect(result.ok).toBe(true);
    expect(initialize).toHaveBeenCalledWith({
      token: "live_nexo_client_token",
      environment: "production",
    });
  });
});

describe("overlay checkout does not grant entitlements", () => {
  it("opens overlay one-page checkout with the server-resolved priceId and optional email", () => {
    const open = vi.fn();
    const paddle = { Checkout: { open } } as unknown as Paddle;
    openPaddleOverlayCheckout(paddle, {
      priceId: "pri_from_server",
      email: "artist@example.com",
      customData: { nexo_plan_id: "artist_pro" },
      settings: { successUrl: "https://nexomusicdistribution.com/billing/success" },
    });
    expect(open).toHaveBeenCalledWith({
      items: [{ priceId: "pri_from_server", quantity: 1 }],
      customer: { email: "artist@example.com" },
      customData: { nexo_plan_id: "artist_pro" },
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        successUrl: "https://nexomusicdistribution.com/billing/success",
        allowLogout: false,
      },
    });
    const payload = JSON.stringify(open.mock.calls[0]?.[0]);
    expect(payload).not.toMatch(/paidAccess/);
    expect(payload).not.toMatch(/grantPaid|markPaid|entitlement/);
  });

  it("does not open checkout without a server price ID", () => {
    const open = vi.fn();
    const paddle = { Checkout: { open } } as unknown as Paddle;
    expect(() => openPaddleOverlayCheckout(paddle, { priceId: "" })).toThrow(/could not start/);
    expect(open).not.toHaveBeenCalled();
  });
});

describe("frontend billing sources never grant paid access or leak secrets", () => {
  it("client paddle helper never references API keys or webhook secrets as browser config", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/billing/paddle.client.ts"), "utf8");
    expect(src).toContain("process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
    expect(src).toContain("initializePaddle");
    expect(src).toContain("displayMode: \"overlay\"");
    expect(src).toContain('variant: "one-page"');
    expect(src).not.toMatch(/process\.env\.PADDLE_API_KEY/);
    expect(src).not.toMatch(/process\.env\.PADDLE_WEBHOOK_SECRET/);
    expect(src).not.toMatch(/paidAccess\s*=\s*true/);
    expect(src).not.toMatch(/grantPaid|markPaid/);
  });

  it("pricing buttons send plan id + interval only and wait for webhook on success", () => {
    const table = readFileSync(join(process.cwd(), "src/components/billing/PricingTable.tsx"), "utf8");
    expect(table).toContain('JSON.stringify({ planId, interval })');
    expect(table).toContain("getPaddleBrowserClient");
    expect(table).toContain("openPaddleOverlayCheckout");
    expect(table).not.toMatch(/priceId:\s*tier/);
    expect(table).not.toMatch(/amount:\s*/);
    expect(table).not.toMatch(/paidAccess\s*=\s*true/);
    expect(table).not.toMatch(/grantPaid|markPaid/);
    const success = readFileSync(
      join(process.cwd(), "src/app/(portal)/billing/success/page.tsx"),
      "utf8"
    );
    expect(success).toContain("verified webhook");
    expect(success).not.toMatch(/paidAccess/);
  });
});
