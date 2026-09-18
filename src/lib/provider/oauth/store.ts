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

export type DistributionCredentialMetadata = {
  scope: string | null;
  expiresAt: string | null;
  verifiedAt: string | null;
  tokenType: string | null;
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

let refreshInFlight: Promise<string | null> | null = null;

async function refreshStoredCredential(data: StoredCredential): Promise<string | null> {
  if (!data.refresh_token_ciphertext) return null;
  const refreshToken = decryptDistributionSecret(data.refresh_token_ciphertext);
  const refreshed = await refreshDistributionAccessToken(refreshToken);
  // OAuth refresh responses commonly omit scope when it is unchanged. Preserve the
  // last provider-reported grant so capability diagnostics do not regress to unknown.
  if (!refreshed.scope && data.scope) refreshed.scope = data.scope;
  await saveDistributionToken(refreshed);
  return refreshed.access_token;
}

function refreshStoredCredentialOnce(data: StoredCredential): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshStoredCredential(data).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
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
  if (shouldRefresh) return refreshStoredCredentialOnce(data);
  return decryptDistributionSecret(data.access_token_ciphertext);
}

export async function forceRefreshDistributionAccessToken(): Promise<string | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("distribution_provider_credentials")
    .select("access_token_ciphertext,refresh_token_ciphertext,expires_at,token_type,scope")
    .eq("connection_key", "primary")
    .maybeSingle<StoredCredential>();
  if (error || !data) return null;
  return refreshStoredCredentialOnce(data);
}

export async function getDistributionCredentialMetadata(): Promise<DistributionCredentialMetadata | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("distribution_provider_credentials")
    .select("scope,expires_at,verified_at,token_type")
    .eq("connection_key", "primary")
    .maybeSingle();
  if (error || !data) return null;
  return {
    scope: typeof data.scope === "string" ? data.scope : null,
    expiresAt: typeof data.expires_at === "string" ? data.expires_at : null,
    verifiedAt: typeof data.verified_at === "string" ? data.verified_at : null,
    tokenType: typeof data.token_type === "string" ? data.token_type : null,
  };
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


export async function getStoredDistributionScopes(): Promise<string[]> {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("distribution_provider_credentials")
      .select("scope")
      .eq("connection_key", "primary")
      .maybeSingle<{ scope: string | null }>();
    if (error || !data?.scope) return [];
    return data.scope
      .split(/[\s,]+/)
      .map((scope) => scope.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
