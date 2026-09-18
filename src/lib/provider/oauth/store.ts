import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { decryptDistributionSecret, encryptDistributionSecret } from "./crypto";
import { refreshDistributionAccessToken, type DistributionOAuthToken } from "./token";

type StoredCredential = {
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  expires_at: string | null;
  token_type: string | null;
  scope: string | null;
};

export async function saveDistributionToken(token: DistributionOAuthToken): Promise<void> {
  const db = createServiceClient();
  const expiresAt =
    typeof token.expires_in === "number"
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;
  const { error } = await db.from("distribution_provider_credentials").upsert(
    {
      connection_key: "primary",
      access_token_ciphertext: encryptDistributionSecret(token.access_token),
      refresh_token_ciphertext:
        typeof token.refresh_token === "string" && token.refresh_token
          ? encryptDistributionSecret(token.refresh_token)
          : null,
      token_type: typeof token.token_type === "string" ? token.token_type : null,
      scope: typeof token.scope === "string" ? token.scope : null,
      expires_at: expiresAt,
      verified_at: null,
    },
    { onConflict: "connection_key" }
  );
  if (error) throw new Error("Could not securely save Distribution Engine credentials.");
}

export async function loadDistributionAccessToken(): Promise<string | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("distribution_provider_credentials")
    .select("access_token_ciphertext,refresh_token_ciphertext,expires_at,token_type,scope")
    .eq("connection_key", "primary")
    .maybeSingle<StoredCredential>();
  if (error || !data) return null;
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null;
  const shouldRefresh = expiresAt !== null && expiresAt <= Date.now() + 60_000;
  if (shouldRefresh && data.refresh_token_ciphertext) {
    const refreshed = await refreshDistributionAccessToken(
      decryptDistributionSecret(data.refresh_token_ciphertext)
    );
    await saveDistributionToken(refreshed);
    return refreshed.access_token;
  }
  if (shouldRefresh) return null;
  return decryptDistributionSecret(data.access_token_ciphertext);
}

export async function markDistributionCredentialVerified(): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("distribution_provider_credentials")
    .update({ verified_at: new Date().toISOString() })
    .eq("connection_key", "primary");
  if (error) throw new Error("Could not mark Distribution Engine credentials as verified.");
}

export async function hasDistributionCredential(): Promise<boolean> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("distribution_provider_credentials")
    .select("access_token_ciphertext")
    .eq("connection_key", "primary")
    .maybeSingle();
  return !error && Boolean(data?.access_token_ciphertext);
}


const WEBHOOK_SECRET_KEY = "provider_webhook_hmac";

export async function saveDistributionWebhookSecret(
  secret: string,
  updatedBy?: string | null
): Promise<void> {
  const value = secret.trim();
  if (value.length < 16) {
    throw new Error("Webhook secret must be at least 16 characters.");
  }
  const db = createServiceClient();
  const { error } = await db.from("distribution_provider_secrets").upsert(
    {
      secret_key: WEBHOOK_SECRET_KEY,
      secret_ciphertext: encryptDistributionSecret(value),
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "secret_key" }
  );
  if (error) throw new Error("Could not securely save the provider webhook secret.");
}

export async function loadDistributionWebhookSecret(): Promise<string | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("distribution_provider_secrets")
    .select("secret_ciphertext")
    .eq("secret_key", WEBHOOK_SECRET_KEY)
    .maybeSingle();
  if (error || !data?.secret_ciphertext) return null;
  try {
    return decryptDistributionSecret(data.secret_ciphertext);
  } catch {
    return null;
  }
}

export async function hasDistributionWebhookSecret(): Promise<boolean> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("distribution_provider_secrets")
    .select("secret_key")
    .eq("secret_key", WEBHOOK_SECRET_KEY)
    .maybeSingle();
  return !error && Boolean(data?.secret_key);
}

export async function removeDistributionWebhookSecret(): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("distribution_provider_secrets")
    .delete()
    .eq("secret_key", WEBHOOK_SECRET_KEY);
  if (error) throw new Error("Could not remove the provider webhook secret.");
}
