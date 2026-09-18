"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";

const TYPES = new Set(["bank_transfer", "paypal", "payoneer", "mobile_money", "other"]);
const STATUSES = new Set(["active", "disabled", "verification_required"]);

export async function adminSavePayoutMethodAction(input: {
  id?: string;
  userId: string;
  methodType: string;
  displayName: string;
  beneficiaryName: string;
  countryCode?: string;
  currency?: string;
  details?: Record<string, string>;
  preferred?: boolean;
  status?: string;
  adminNote?: string;
}): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const ctx = await RequireAdminPermission("admin:payouts");
  if (!/^[0-9a-f-]{36}$/i.test(input.userId)) return { ok: false, error: "Valid user ID required." };
  if (!TYPES.has(input.methodType)) return { ok: false, error: "Invalid payout method type." };
  const status = input.status || "active";
  if (!STATUSES.has(status)) return { ok: false, error: "Invalid payout method status." };

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("id").eq("id", input.userId).maybeSingle();
  if (!profile) return { ok: false, error: "Account not found." };

  if (input.preferred) {
    await service.from("payout_methods").update({ is_preferred: false }).eq("user_id", input.userId);
  }

  const payload = {
    user_id: input.userId,
    method_type: input.methodType,
    display_name: input.displayName.trim().slice(0, 120),
    beneficiary_name: input.beneficiaryName.trim().slice(0, 200),
    country_code: input.countryCode?.trim().toUpperCase() || null,
    currency: input.currency?.trim().toUpperCase() || null,
    details: input.details ?? {},
    provider: "manual",
    is_preferred: Boolean(input.preferred),
    status,
    admin_note: input.adminNote?.trim().slice(0, 1000) || null,
    updated_by_admin: ctx.userId,
  };

  const query = input.id
    ? service.from("payout_methods").update(payload).eq("id", input.id)
    : service.from("payout_methods").insert(payload);
  const { data, error } = await query.select("id").single();
  if (error || !data) return { ok: false, error: error?.message || "Could not save payout method." };

  revalidatePath("/admin/finance/payout-methods");
  revalidatePath("/earnings/payouts");
  return { ok: true, data: { id: data.id } };
}

export async function adminSetPayoutMethodStatusAction(input: {
  id: string;
  userId: string;
  status: "active" | "disabled" | "verification_required";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireAdminPermission("admin:payouts");
  const service = createServiceClient();
  const { error } = await service
    .from("payout_methods")
    .update({
      status: input.status,
      is_preferred: input.status === "active" ? undefined : false,
      updated_by_admin: ctx.userId,
    })
    .eq("id", input.id)
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/finance/payout-methods");
  revalidatePath("/earnings/payouts");
  return { ok: true };
}

export async function adminSetPreferredPayoutMethodAction(input: {
  id: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireAdminPermission("admin:payouts");
  const service = createServiceClient();
  const { data: method } = await service
    .from("payout_methods")
    .select("id,status")
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!method || method.status !== "active") return { ok: false, error: "Active payout method not found." };
  await service.from("payout_methods").update({ is_preferred: false }).eq("user_id", input.userId);
  const { error } = await service
    .from("payout_methods")
    .update({ is_preferred: true, updated_by_admin: ctx.userId })
    .eq("id", input.id)
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/finance/payout-methods");
  revalidatePath("/earnings/payouts");
  return { ok: true };
}
