"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import {
  removeDistributionWebhookSecret,
  saveDistributionWebhookSecret,
} from "@/lib/provider/oauth/store";

export async function saveProviderWebhookSecretAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:distribution");
  const secret = String(formData.get("webhook_secret") ?? "").trim();
  if (secret.length < 16) {
    throw new Error("Webhook secret must be at least 16 characters.");
  }
  await saveDistributionWebhookSecret(secret, ctx.userId);
  revalidatePath("/admin/distribution");
  revalidatePath("/admin/distribution/provider");
}

export async function removeProviderWebhookSecretAction() {
  await RequireAdminPermission("admin:distribution");
  await removeDistributionWebhookSecret();
  revalidatePath("/admin/distribution");
  revalidatePath("/admin/distribution/provider");
}
