import "server-only";

import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { getProviderWebhookSecret } from "@/lib/provider/config";
import {
  decryptDistributionSecret,
  encryptDistributionSecret,
} from "@/lib/provider/oauth/crypto";

const WEBHOOK_SECRET_KEY = "distribution_webhook_hmac";

export type ProviderWebhookSecretSource = "environment" | "database";

type StoredSecret = {
  secret_ciphertext: string;
};

export async function hasRuntimeProviderWebhookSecret(): Promise<boolean> {
  if (getProviderWebhookSecret()) return true;

  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("distribution_provider_secrets")
      .select("secret_ciphertext")
      .eq("secret_key", WEBHOOK_SECRET_KEY)
      .maybeSingle<StoredSecret>();

    return !error && Boolean(data?.secret_ciphertext);
  } catch {
    // Missing service-role runtime must never crash provider status or webhook guards.
    // Returning false keeps the endpoint fail-closed until a secret can be loaded.
    return false;
  }
}

export async function loadRuntimeProviderWebhookSecret(): Promise<{
  secret: string;
  source: ProviderWebhookSecretSource;
} | null> {
  const envSecret = getProviderWebhookSecret();
  if (envSecret) return { secret: envSecret, source: "environment" };

  const db = createServiceClient();
  const { data, error } = await db
    .from("distribution_provider_secrets")
    .select("secret_ciphertext")
    .eq("secret_key", WEBHOOK_SECRET_KEY)
    .maybeSingle<StoredSecret>();

  if (error || !data?.secret_ciphertext) return null;

  return {
    secret: decryptDistributionSecret(data.secret_ciphertext),
    source: "database",
  };
}

export async function ensureRuntimeProviderWebhookSecret(
  updatedBy?: string | null
): Promise<{
  secret: string;
  source: ProviderWebhookSecretSource;
  created: boolean;
}> {
  const existing = await loadRuntimeProviderWebhookSecret();
  if (existing) return { ...existing, created: false };

  const secret = randomBytes(32).toString("base64url");
  const db = createServiceClient();
  const { error } = await db.from("distribution_provider_secrets").upsert(
    {
      secret_key: WEBHOOK_SECRET_KEY,
      secret_ciphertext: encryptDistributionSecret(secret),
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "secret_key" }
  );

  if (error) {
    throw new Error("Could not securely provision the Distribution Engine webhook secret.");
  }

  return { secret, source: "database", created: true };
}

export async function rotateRuntimeProviderWebhookSecret(
  updatedBy?: string | null
): Promise<{
  secret: string;
  source: ProviderWebhookSecretSource;
}> {
  if (getProviderWebhookSecret()) {
    throw new Error(
      "The webhook secret is managed by the server environment and cannot be rotated from the admin panel."
    );
  }

  const secret = randomBytes(32).toString("base64url");
  const db = createServiceClient();
  const { error } = await db.from("distribution_provider_secrets").upsert(
    {
      secret_key: WEBHOOK_SECRET_KEY,
      secret_ciphertext: encryptDistributionSecret(secret),
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "secret_key" }
  );

  if (error) {
    throw new Error("Could not rotate the Distribution Engine webhook secret.");
  }

  return { secret, source: "database" };
}
