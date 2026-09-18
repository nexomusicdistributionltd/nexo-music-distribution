import "server-only";

import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { decryptDistributionSecret, encryptDistributionSecret } from "@/lib/provider/oauth/crypto";

const WEBHOOK_CONNECTION_KEY = "provider_webhook_signing";

export type ProviderWebhookSecretSource = "environment" | "secure_store" | "missing";

export type ProviderWebhookSecretState = {
  configured: boolean;
  source: ProviderWebhookSecretSource;
  created: boolean;
  revealSecret: string | null;
};

function envWebhookSecret(): string | null {
  const secret =
    (process.env.DISTRIBUTION_WEBHOOK_SECRET ?? "").trim() ||
    (process.env.PROVIDER_WEBHOOK_SECRET ?? "").trim();
  return secret || null;
}

async function loadStoredSecret(): Promise<string | null> {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("distribution_provider_credentials")
      .select("access_token_ciphertext")
      .eq("connection_key", WEBHOOK_CONNECTION_KEY)
      .maybeSingle<{ access_token_ciphertext: string }>();

    if (error || !data?.access_token_ciphertext) return null;
    return decryptDistributionSecret(data.access_token_ciphertext);
  } catch {
    return null;
  }
}

async function persistStoredSecret(secret: string): Promise<void> {
  const trimmed = secret.trim();
  if (trimmed.length < 16) {
    throw new Error("Webhook signing secret must be at least 16 characters.");
  }

  const db = createServiceClient();
  const { error } = await db.from("distribution_provider_credentials").upsert(
    {
      connection_key: WEBHOOK_CONNECTION_KEY,
      access_token_ciphertext: encryptDistributionSecret(trimmed),
      refresh_token_ciphertext: null,
      token_type: "HMAC-SHA256",
      scope: "provider:webhook",
      expires_at: null,
      provider_account_ref: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_key" }
  );

  if (error) {
    throw new Error("Could not securely save the provider webhook signing secret.");
  }
}

export async function loadProviderWebhookSigningSecret(): Promise<string | null> {
  return envWebhookSecret() ?? (await loadStoredSecret());
}

export async function hasProviderWebhookSigningSecret(): Promise<boolean> {
  return Boolean(await loadProviderWebhookSigningSecret());
}

export async function ensureProviderWebhookSigningSecret(): Promise<ProviderWebhookSecretState> {
  const fromEnv = envWebhookSecret();
  if (fromEnv) {
    return {
      configured: true,
      source: "environment",
      created: false,
      revealSecret: null,
    };
  }

  const stored = await loadStoredSecret();
  if (stored) {
    return {
      configured: true,
      source: "secure_store",
      created: false,
      revealSecret: null,
    };
  }

  const generated = randomBytes(32).toString("base64url");
  await persistStoredSecret(generated);
  return {
    configured: true,
    source: "secure_store",
    created: true,
    revealSecret: generated,
  };
}

export async function setProviderWebhookSigningSecret(secret: string): Promise<void> {
  await persistStoredSecret(secret);
}

export async function rotateProviderWebhookSigningSecret(): Promise<string> {
  const generated = randomBytes(32).toString("base64url");
  await persistStoredSecret(generated);
  return generated;
}
