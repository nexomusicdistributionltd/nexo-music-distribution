import "server-only";

import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import {
  getPaddleApiKey,
  getPaddleWebhookSecret,
  requirePaddleEnvironment,
  type PaddleBillingEnvironment,
} from "./env";

let cached: { env: PaddleBillingEnvironment; key: string; client: Paddle } | null = null;

function sdkEnvironment(env: PaddleBillingEnvironment): Environment {
  return env === "sandbox" ? Environment.sandbox : Environment.production;
}

/**
 * Server Paddle client. API key is required for portal sessions and catalog ops.
 * Webhook unmarshal uses the webhook secret, not the API key.
 */
export function getPaddleServerClient(env: NodeJS.ProcessEnv = process.env): Paddle {
  const environment = requirePaddleEnvironment(env);
  const key = getPaddleApiKey(env);
  if (!key) {
    throw new Error(
      "PADDLE_API_KEY (or PADDLE_SANDBOX_API_KEY) is required for Paddle API calls. Sandbox catalog/API is not configured in this environment."
    );
  }
  if (cached && cached.env === environment && cached.key === key) return cached.client;
  const client = new Paddle(key, { environment: sdkEnvironment(environment) });
  cached = { env: environment, key, client };
  return client;
}

/** Client used only to unmarshal webhook signatures. Does not call the Paddle API. */
export function getPaddleWebhookVerifier(env: NodeJS.ProcessEnv = process.env): Paddle {
  const environment = requirePaddleEnvironment(env);
  const key = getPaddleApiKey(env) || "unused_signature_verification_only";
  return new Paddle(key, { environment: sdkEnvironment(environment) });
}

export async function unmarshalPaddleWebhook(
  rawBody: string,
  signature: string,
  env: NodeJS.ProcessEnv = process.env
) {
  const secret = getPaddleWebhookSecret(env);
  if (!secret) {
    throw new Error("PADDLE_WEBHOOK_SECRET missing — fail closed.");
  }
  if (!signature?.trim()) {
    throw new Error("Missing Paddle-Signature header.");
  }
  const paddle = getPaddleWebhookVerifier(env);
  return paddle.webhooks.unmarshal(rawBody, secret, signature);
}

export function __resetPaddleClientCacheForTests() {
  cached = null;
}
