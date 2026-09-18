"use server";

import { revalidatePath } from "next/cache";
import { RequireRole } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import { isPayoutMethodType, maskDestination } from "@/lib/finance/payout-methods";

export async function savePayoutMethodAction(input: {
  methodType: string;
  label: string;
  destination: string;
  accountHolder?: string;
  bankName?: string;
  country?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireRole(["artist", "label"]);
  if (!isPayoutMethodType(input.methodType)) return { ok: false, error: "Unsupported payout method." };
  const label = input.label.trim();
  const destination = input.destination.trim();
  if (!label || !destination) return { ok: false, error: "Method label and payout destination are required." };

  const service = createServiceClient();
  const { count } = await service
    .from("payout_methods")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", ctx.userId)
    .neq("status", "disabled");
  const preferred = (count ?? 0) === 0;

  const { error } = await service.from("payout_methods").insert({
    owner_user_id: ctx.userId,
    method_type: input.methodType,
    label: label.slice(0, 120),
    destination_mask: maskDestination(destination),
    details: {
      destination,
      account_holder: input.accountHolder?.trim() || null,
      bank_name: input.bankName?.trim() || null,
      country: input.country?.trim() || null,
    },
    is_preferred: preferred,
    source: "user",
    status: "active",
    created_by: ctx.userId,
  });
  if (error) return { ok: false, error: "Could not save payout method." };
  revalidatePath("/earnings/payouts");
  return { ok: true };
}

export async function setPreferredPayoutMethodAction(id: string) {
  const ctx = await RequireRole(["artist", "label"]);
  const service = createServiceClient();
  const { data: owned } = await service
    .from("payout_methods")
    .select("id")
    .eq("id", id)
    .eq("owner_user_id", ctx.userId)
    .neq("status", "disabled")
    .maybeSingle();
  if (!owned) return { ok: false as const, error: "Payout method not found." };
  await service.from("payout_methods").update({ is_preferred: false }).eq("owner_user_id", ctx.userId);
  const { error } = await service
    .from("payout_methods")
    .update({ is_preferred: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_user_id", ctx.userId);
  if (error) return { ok: false as const, error: "Could not update preferred payout method." };
  revalidatePath("/earnings/payouts");
  return { ok: true as const };
}

export async function disablePayoutMethodAction(id: string) {
  const ctx = await RequireRole(["artist", "label"]);
  const service = createServiceClient();
  const { error } = await service
    .from("payout_methods")
    .update({ status: "disabled", is_preferred: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_user_id", ctx.userId);
  if (error) return { ok: false as const, error: "Could not disable payout method." };
  revalidatePath("/earnings/payouts");
  return { ok: true as const };
}
