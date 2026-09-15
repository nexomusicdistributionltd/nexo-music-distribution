/**
 * Paddle Billing environment. Fail loud — never silently default to sandbox.
 * Secrets must never be logged or exposed via NEXT_PUBLIC_*.
 */

export type PaddleBillingEnvironment = "sandbox" | "production";

export class PaddleEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaddleEnvError";
  }
}

export function readPaddleEnvironment(
  env: NodeJS.ProcessEnv = process.env
): PaddleBillingEnvironment | null {
  const raw = env.PADDLE_ENVIRONMENT?.trim();
  if (!raw) return null;
  if (raw === "sandbox" || raw === "production") return raw;
  throw new PaddleEnvError(
    `Invalid PADDLE_ENVIRONMENT="${raw}". Use sandbox or production. No silent default.`
  );
}

/** FAIL LOUDLY if unset. Never default to sandbox. */
export function requirePaddleEnvironment(
  env: NodeJS.ProcessEnv = process.env
): PaddleBillingEnvironment {
  const value = readPaddleEnvironment(env);
  if (!value) {
    throw new PaddleEnvError(
      "PADDLE_ENVIRONMENT is required (sandbox|production). No silent default."
    );
  }
  return value;
}

export function getPaddleApiKey(env: NodeJS.ProcessEnv = process.env): string {
  return env.PADDLE_API_KEY?.trim() || env.PADDLE_SANDBOX_API_KEY?.trim() || "";
}

export function getPaddleWebhookSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.PADDLE_WEBHOOK_SECRET?.trim() || "";
}

export function getPaddleClientToken(env: NodeJS.ProcessEnv = process.env): string {
  return env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() || "";
}

/** Maps PADDLE_ENVIRONMENT onto Paddle.js Environments. Never silently defaults. */
export function paddleJsEnvironmentFromEnv(
  env: NodeJS.ProcessEnv = process.env
): "sandbox" | "production" | null {
  return readPaddleEnvironment(env);
}

export function assertNoSecretInPublicEnv(env: NodeJS.ProcessEnv = process.env): void {
  const forbidden = [
    "NEXT_PUBLIC_PADDLE_API_KEY",
    "NEXT_PUBLIC_PADDLE_SANDBOX_API_KEY",
    "NEXT_PUBLIC_PADDLE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_PADDLE_SECRET",
  ];
  for (const name of forbidden) {
    if (env[name]?.trim()) {
      throw new PaddleEnvError(
        `${name} must never be set. API keys and webhook secrets are server-only.`
      );
    }
  }
}

export function paddleClientConfig(env: NodeJS.ProcessEnv = process.env): {
  environment: PaddleBillingEnvironment | null;
  clientTokenPresent: boolean;
  apiKeyPresent: boolean;
  webhookSecretPresent: boolean;
} {
  return {
    environment: readPaddleEnvironment(env),
    clientTokenPresent: Boolean(getPaddleClientToken(env)),
    apiKeyPresent: Boolean(getPaddleApiKey(env)),
    webhookSecretPresent: Boolean(getPaddleWebhookSecret(env)),
  };
}
