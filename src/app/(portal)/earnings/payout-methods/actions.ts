"use server";

import { revalidatePath } from "next/cache";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";

const METHOD_TYPES = new Set([
  "bank_transfer",
  "paypal",
  "payoneer",
  "mobile_money",
  "other",
]);

function cleanDetails(input: Record<string, unknown>): Record<string, string> {
  const allowed = new Set([
    "bank_name",
    "account_number",
    "routing_code",
    "swift_bic",
    "iban",
    "email",
    "phone",
    "provider_name",
    "destination",
    "notes",
  ]);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key) || typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    out[key] = trimmed.slice(0, key === "notes" ? 500 : 160);
  }
  return out;
}

export async function savePayoutMethodAction(input: {
  id?: string;
  methodType: string;
  displayName: string;
  countryCode?: string;
  currency?: string;
  beneficiaryName: string;
  details: Record<string, unknown>;
  preferred?: boolean;
}): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const ctx = await RequireVerifiedPortal();
  if (!METHOD_TYPES.has(input.methodType)) {
    return { ok: false, error: "Select a supported payout method." };
  }
  const displayName = input.displayName.trim();
  const beneficiaryName = input.beneficiaryName.trim();
  if (displayName.length < 2 || displayName.length > 120) {
    return { ok: false, error: "Enter a payout method name." };
  }
  if (beneficiaryName.length < 2 || beneficiaryName.length > 200) {
    return { ok: false, error: "Enter the beneficiary name." };
  }
  const countryCode = input.countryCode?.trim().toUpperCase() || null;
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    return { ok: false, error: "Country must be an ISO-2 code." };
  }
  const currency = input.currency?.trim().toUpperCase() || null;
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, error: "Currency must be a 3-letter code." };
  }

  const details = cleanDetails(input.details);
  if (Object.keys(details).length === 0) {
    return { ok: false, error: "Add the payout destination details." };
  }

  const service = createServiceClient();
  if (input.id) {
    const { data: existing } = await service
      .from("payout_methods")
      .select("id")
      .eq("id", input.id)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (!existing) return { ok: false, error: "Payout method not found." };
  }

  if (input.preferred) {
    await service
      .from("payout_methods")
      .update({ is_preferred: false })
      .eq("user_id", ctx.userId);
  }

  const payload = {
    user_id: ctx.userId,
    method_type: input.methodType,
    display_name: displayName,
    country_code: countryCode,
    currency,
    beneficiary_name: beneficiaryName,
    details,
    provider: "manual",
    is_preferred: Boolean(input.preferred),
    status: "active",
  };

  const query = input.id
    ? service
        .from("payout_methods")
        .update(payload)
        .eq("id", input.id)
        .eq("user_id", ctx.userId)
    : service.from("payout_methods").insert(payload);

  const { data, error } = await query.select("id").single();
  if (error || !data) {
    return { ok: false, error: error?.message || "Could not save payout method." };
  }

  const { count } = await service
    .from("payout_methods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("is_preferred", true)
    .eq("status", "active");
  if (!input.preferred && (count ?? 0) === 0) {
    await service
      .from("payout_methods")
      .update({ is_preferred: true })
      .eq("id", data.id)
      .eq("user_id", ctx.userId);
  }

  revalidatePath("/earnings/payouts");
  return { ok: true, data: { id: data.id } };
}

export async function setPreferredPayoutMethodAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireVerifiedPortal();
  const service = createServiceClient();
  const { data: existing } = await service
    .from("payout_methods")
    .select("id")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!existing) return { ok: false, error: "Payout method not found." };

  await service.from("payout_methods").update({ is_preferred: false }).eq("user_id", ctx.userId);
  const { error } = await service
    .from("payout_methods")
    .update({ is_preferred: true })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/earnings/payouts");
  return { ok: true };
}

export async function deletePayoutMethodAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireVerifiedPortal();
  const service = createServiceClient();
  const { data: row } = await service
    .from("payout_methods")
    .select("id,is_preferred")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Payout method not found." };

  const { error } = await service
    .from("payout_methods")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };

  if (row.is_preferred) {
    const { data: next } = await service
      .from("payout_methods")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next?.id) {
      await service.from("payout_methods").update({ is_preferred: true }).eq("id", next.id);
    }
  }
  revalidatePath("/earnings/payouts");
  return { ok: true };
}
