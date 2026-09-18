import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import { decryptDistributionSecret, encryptDistributionSecret } from "@/lib/provider/oauth/crypto";
import { getProviderWebhookSecret } from "@/lib/provider/config";

export type ProviderWebhookRuntimeSettings = {
  configured: boolean;
  enabled: boolean;
  secret: string | null;
  signatureHeader: string;
  source: "environment" | "database" | "none";
};

const DEFAULT_HEADER = "x-provider-signature";

export async function getProviderWebhookRuntimeSettings(): Promise<ProviderWebhookRuntimeSettings> {
  const envSecret = getProviderWebhookSecret();
  if (envSecret) {
    return {
      configured: true,
      enabled: true,
      secret: envSecret,
      signatureHeader: (process.env.PROVIDER_WEBHOOK_SIGNATURE_HEADER ?? DEFAULT_HEADER).trim().toLowerCase(),
      source: "environment",
    };
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("distribution_webhook_settings")
    .select("secret_ciphertext,signature_header,enabled")
    .eq("connection_key", "primary")
    .maybeSingle();

  if (error || !data || !data.enabled || !data.secret_ciphertext) {
    return {
      configured: false,
      enabled: Boolean(data?.enabled),
      secret: null,
      signatureHeader: String(data?.signature_header || DEFAULT_HEADER).trim().toLowerCase(),
      source: "none",
    };
  }

  try {
    const secret = decryptDistributionSecret(data.secret_ciphertext);
    return {
      configured: Boolean(secret),
      enabled: true,
      secret: secret || null,
      signatureHeader: String(data.signature_header || DEFAULT_HEADER).trim().toLowerCase(),
      source: "database",
    };
  } catch {
    return {
      configured: false,
      enabled: true,
      secret: null,
      signatureHeader: String(data.signature_header || DEFAULT_HEADER).trim().toLowerCase(),
      source: "none",
    };
  }
}

export async function saveProviderWebhookRuntimeSettings(input: {
  secret?: string;
  signatureHeader: string;
  enabled: boolean;
  updatedBy: string;
}): Promise<void> {
  const header = input.signatureHeader.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,120}$/.test(header)) {
    throw new Error("Webhook signature header must be a valid HTTP header name.");
  }

  const db = createServiceClient();
  const { data: current } = await db
    .from("distribution_webhook_settings")
    .select("secret_ciphertext")
    .eq("connection_key", "primary")
    .maybeSingle();

  const secret = input.secret?.trim();
  const secretCiphertext = secret
    ? encryptDistributionSecret(secret)
    : current?.secret_ciphertext ?? null;

  if (input.enabled && !secretCiphertext && !getProviderWebhookSecret()) {
    throw new Error("Add the provider-issued webhook signing secret before enabling webhooks.");
  }

  const { error } = await db.from("distribution_webhook_settings").upsert(
    {
      connection_key: "primary",
      secret_ciphertext: secretCiphertext,
      signature_header: header,
      enabled: input.enabled,
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_key" }
  );
  if (error) throw new Error("Could not save webhook signing settings.");
}

export async function clearStoredProviderWebhookSecret(updatedBy: string): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("distribution_webhook_settings")
    .update({
      secret_ciphertext: null,
      enabled: false,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("connection_key", "primary");
  if (error) throw new Error("Could not remove the stored webhook secret.");
}
