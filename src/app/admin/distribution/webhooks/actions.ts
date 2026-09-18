"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import {
  clearStoredProviderWebhookSecret,
  saveProviderWebhookRuntimeSettings,
} from "@/lib/provider/webhook-settings";

export async function saveProviderWebhookSettingsAction(input: {
  secret?: string;
  signatureHeader: string;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireAdminPermission("admin:distribution");
  try {
    await saveProviderWebhookRuntimeSettings({
      secret: input.secret,
      signatureHeader: input.signatureHeader,
      enabled: input.enabled,
      updatedBy: ctx.userId,
    });
    revalidatePath("/admin/distribution/webhooks");
    revalidatePath("/admin/distribution");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save webhook settings.",
    };
  }
}

export async function clearProviderWebhookSecretAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const ctx = await RequireAdminPermission("admin:distribution");
  try {
    await clearStoredProviderWebhookSecret(ctx.userId);
    revalidatePath("/admin/distribution/webhooks");
    revalidatePath("/admin/distribution");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not remove webhook signing secret.",
    };
  }
}
