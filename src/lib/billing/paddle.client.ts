"use client";

import { initializePaddle, type Environments, type Paddle } from "@paddle/paddle-js";
import type { PaddleBillingEnvironment } from "./env";

/** User-facing copy when Paddle.js cannot start. Safe to show on /pricing. */
export const MISSING_PADDLE_CLIENT_TOKEN_USER_MESSAGE =
  "Checkout is unavailable right now. Payment is not configured on this site yet.";

export const MISSING_PADDLE_ENVIRONMENT_USER_MESSAGE =
  "Checkout is unavailable right now. Billing environment is not configured.";

export const PADDLE_JS_INIT_FAILED_USER_MESSAGE =
  "Checkout could not start. Please try again in a moment.";

export const MISSING_PADDLE_CLIENT_TOKEN_DEV_MESSAGE =
  "[billing] NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set. Paddle.js will not initialize. Set this Netlify environment variable (live_ for production, test_ for sandbox). Never expose PADDLE_API_KEY or PADDLE_WEBHOOK_SECRET to the browser.";

export type PaddleJsInitSuccess = {
  ok: true;
  token: string;
  environment: Environments;
};

export type PaddleJsInitFailure = {
  ok: false;
  code: "missing_token" | "missing_environment";
  error: string;
};

export type PaddleJsInitResult = PaddleJsInitSuccess | PaddleJsInitFailure;

export type ServerCheckoutOpenPayload = {
  priceId: string;
  email?: string;
  customData?: Record<string, string>;
  settings?: {
    displayMode?: "overlay";
    variant?: "one-page";
    successUrl?: string;
    allowLogout?: boolean;
  };
};

type InitCache = { key: string; promise: Promise<Paddle> };

let initCache: InitCache | null = null;
let missingTokenWarned = false;

/**
 * Resolve Paddle.js init options.
 * Token comes from NEXT_PUBLIC_PADDLE_CLIENT_TOKEN (browser-safe).
 * Environment must match PADDLE_ENVIRONMENT (sandbox | production) — never silently default.
 */
export function resolvePaddleJsInit(input: {
  environment: PaddleBillingEnvironment | null | undefined;
  token?: string | null;
  env?: NodeJS.ProcessEnv;
}): PaddleJsInitResult {
  const fromExplicit = input.token?.trim();
  const fromProvidedEnv = input.env ? input.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() : undefined;
  // Direct process.env access so Next.js inlines NEXT_PUBLIC_PADDLE_CLIENT_TOKEN in the client bundle.
  const fromProcess = input.env ? undefined : process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim();
  const token = (fromExplicit || fromProvidedEnv || fromProcess || "").replace(/^["']|["']$/g, "");

  if (!token) {
    return { ok: false, code: "missing_token", error: MISSING_PADDLE_CLIENT_TOKEN_USER_MESSAGE };
  }

  if (input.environment !== "sandbox" && input.environment !== "production") {
    return { ok: false, code: "missing_environment", error: MISSING_PADDLE_ENVIRONMENT_USER_MESSAGE };
  }

  return { ok: true, token, environment: input.environment };
}

/**
 * Dev-only console error when the public client token is missing.
 * Never throws — the marketing site must keep rendering.
 */
export function warnIfPaddleClientTokenMissing(
  result: PaddleJsInitResult,
  options?: { nodeEnv?: string; logger?: Pick<Console, "error"> }
): void {
  if (result.ok || result.code !== "missing_token") return;
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv !== "development") return;
  if (missingTokenWarned) return;
  missingTokenWarned = true;
  const logger = options?.logger ?? console;
  logger.error(MISSING_PADDLE_CLIENT_TOKEN_DEV_MESSAGE);
}

export function __resetPaddleBrowserClientForTests(): void {
  initCache = null;
  missingTokenWarned = false;
}

/**
 * Client-only Paddle.js singleton. Uses the public client token only.
 * Callers must pass environment from server-resolved PADDLE_ENVIRONMENT.
 */
export async function getPaddleBrowserClient(input: {
  environment: PaddleBillingEnvironment | null | undefined;
  token?: string | null;
  env?: NodeJS.ProcessEnv;
  initialize?: typeof initializePaddle;
}): Promise<{ ok: true; paddle: Paddle } | PaddleJsInitFailure | { ok: false; code: "init_failed"; error: string }> {
  const resolved = resolvePaddleJsInit(input);
  if (!resolved.ok) {
    warnIfPaddleClientTokenMissing(resolved);
    return resolved;
  }

  const initialize = input.initialize ?? initializePaddle;
  const key = `${resolved.environment}:${resolved.token}`;
  if (initCache && initCache.key === key) {
    try {
      return { ok: true, paddle: await initCache.promise };
    } catch {
      initCache = null;
    }
  }

  const promise = initialize({
    token: resolved.token,
    environment: resolved.environment,
  }).then((instance) => {
    if (!instance) {
      throw new Error("Paddle.js returned no instance.");
    }
    return instance;
  });

  initCache = { key, promise };

  try {
    return { ok: true, paddle: await promise };
  } catch {
    if (initCache?.key === key) initCache = null;
    return { ok: false, code: "init_failed", error: PADDLE_JS_INIT_FAILED_USER_MESSAGE };
  }
}

/**
 * Open overlay one-page checkout with a server-resolved price ID.
 * Does not grant entitlements — success URL waits for webhook sync.
 */
export function openPaddleOverlayCheckout(paddle: Paddle, payload: ServerCheckoutOpenPayload): void {
  const priceId = payload.priceId?.trim() ?? "";
  if (!priceId) {
    throw new Error("Checkout could not start.");
  }
  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: payload.email ? { email: payload.email } : undefined,
    customData: payload.customData,
    settings: {
      displayMode: "overlay",
      variant: "one-page",
      successUrl: payload.settings?.successUrl,
      allowLogout: false,
    },
  });
}
