"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { canTransitionPayout, type PayoutStatus, type MoneyEntryKind } from "@/lib/finance/money";
import { validateSplitShares, type SplitShareInput } from "@/lib/finance/splits";
import { isAllowedFinanceReportType } from "@/lib/finance/exports";
import { getPaymentProvider, paymentNotConnectedMessage } from "@/lib/finance/payment";
import { validatePublishingShares } from "@/lib/publishing/shares";
import type { PublishingRightType } from "@/lib/publishing/types";

import { RATE_LIMITS, checkRateLimit } from "@/lib/security/rate-limit";
export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateFinance() {
  for (const p of [
    "/admin/finance",
    "/admin/royalties",
    "/admin/splitshare",
    "/admin/royalties/imports",
    "/admin/royalties/ledger",
    "/admin/statements",
    "/admin/payouts",
    "/admin/publishing",
    "/earnings",
  ]) {
    revalidatePath(p);
  }
}

export async function createPayoutAction(input: {
  ownerUserId: string;
  amountMinor: number;
  currency: string;
  method?: string;
  idempotencyKey?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:payouts");
  const rl = checkRateLimit({
    key: `admin:payout:create`,
    ...RATE_LIMITS.payoutCreate,
  });
  if (!rl.ok) return { ok: false, error: "Too many payout requests. Try again later." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_payout_request", {
    p_owner_user_id: input.ownerUserId,
    p_amount_minor: input.amountMinor,
    p_currency: input.currency,
    p_method: input.method ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data };
}

export async function updatePayoutStatusFinanceAction(input: {
  payoutId: string;
  status: PayoutStatus;
  reason?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:payouts");
  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("payouts")
    .select("status")
    .eq("id", input.payoutId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!current) return { ok: false, error: "Payout not found." };
  const gate = canTransitionPayout(current.status as PayoutStatus, input.status);
  if (!gate.ok) return { ok: false, error: gate.reason ?? "Not allowed." };
  const { error } = await supabase.rpc("transition_payout_status", {
    p_payout_id: input.payoutId,
    p_new_status: input.status,
    p_reason: input.reason ?? "Admin finance status update",
  });
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data: true };
}

/** Attempt provider payout — truthful UNAVAILABLE when not connected. */
export async function processPayoutWithProviderAction(payoutId: string): Promise<ActionResult> {
  await RequireAdminPermission("admin:payouts");
  const rl = checkRateLimit({
    key: `admin:payout:process`,
    ...RATE_LIMITS.adminMutation,
  });
  if (!rl.ok) return { ok: false, error: "Too many payout process attempts. Try again later." };
  const provider = getPaymentProvider();
  if (!provider.connected) {
    return { ok: false, error: paymentNotConnectedMessage() };
  }
  const supabase = await createClient();
  const { data: payout, error: readErr } = await supabase
    .from("payouts")
    .select("*")
    .eq("id", payoutId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!payout) return { ok: false, error: "Payout not found." };
  if (payout.status !== "approved" && payout.status !== "processing") {
    return { ok: false, error: "Payout must be approved before provider processing." };
  }
  try {
    if (payout.status === "approved") {
      const t = await supabase.rpc("transition_payout_status", {
        p_payout_id: payoutId,
        p_new_status: "processing",
        p_reason: "Provider processing started",
      });
      if (t.error) return { ok: false, error: t.error.message };
    }
    const result = await provider.createPayout({
      payoutId,
      amountMinor: payout.amount_minor,
      currency: payout.currency,
      method: payout.method,
      idempotencyKey: payout.idempotency_key,
    });
    await supabase
      .from("payouts")
      .update({ provider_name: provider.name, provider_payout_id: result.providerPayoutId })
      .eq("id", payoutId);
    revalidateFinance();
    return { ok: true, data: result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : paymentNotConnectedMessage(),
    };
  }
}

/** Mark PAID only via complete_payout_paid RPC — still requires real payment_reference. */
export async function completePayoutPaidAction(input: {
  payoutId: string;
  paymentReference: string;
  providerName?: string;
  providerPayoutId?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:payouts");
  if (!input.paymentReference?.trim()) {
    return { ok: false, error: "payment_reference required from real payment operation." };
  }
  const provider = getPaymentProvider();
  const providerName =
    input.providerName?.trim() || (provider.connected ? provider.name : "manual");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_payout_paid", {
    p_payout_id: input.payoutId,
    p_payment_reference: input.paymentReference.trim(),
    p_provider_name: providerName,
    p_provider_payout_id: input.providerPayoutId?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data };
}

export async function postLedgerAdjustmentAction(input: {
  ownerUserId: string;
  amountMinor: number;
  currency: string;
  kind: MoneyEntryKind;
  description: string;
  compensatingFor?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:finance");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_ledger_adjustment", {
    p_owner_user_id: input.ownerUserId,
    p_amount_minor: input.amountMinor,
    p_currency: input.currency,
    p_kind: input.kind,
    p_description: input.description,
    p_compensating_for: input.compensatingFor ?? null,
    p_balance_bucket: "available",
  });
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data };
}

export async function upsertRoyaltyImportBatchAction(input: {
  sourceProvider: string;
  reportId: string;
  periodStart?: string;
  periodEnd?: string;
  currency?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:royalties");
  const rl = checkRateLimit({
    key: `admin:royalty:import`,
    ...RATE_LIMITS.royaltyImport,
  });
  if (!rl.ok) return { ok: false, error: "Too many import mutations. Try again later." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_royalty_import_batch", {
    p_source_provider: input.sourceProvider,
    p_report_id: input.reportId,
    p_period_start: input.periodStart ?? null,
    p_period_end: input.periodEnd ?? null,
    p_currency: input.currency ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data };
}

export async function upsertRoyaltyImportRowAction(input: {
  batchId: string;
  rowKey: string;
  raw?: Record<string, unknown>;
  amountMinor?: number;
  currency?: string;
  isrc?: string;
  upc?: string;
  territory?: string;
  dspCode?: string;
  periodStart?: string;
  periodEnd?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:royalties");
  const rl = checkRateLimit({
    key: `admin:royalty:import:row`,
    ...RATE_LIMITS.royaltyImport,
  });
  if (!rl.ok) return { ok: false, error: "Too many import mutations. Try again later." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_royalty_import_row", {
    p_batch_id: input.batchId,
    p_row_key: input.rowKey,
    p_raw: input.raw ?? {},
    p_amount_minor: input.amountMinor ?? null,
    p_currency: input.currency ?? null,
    p_isrc: input.isrc ?? null,
    p_upc: input.upc ?? null,
    p_territory: input.territory ?? null,
    p_dsp_code: input.dspCode ?? null,
    p_period_start: input.periodStart ?? null,
    p_period_end: input.periodEnd ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data };
}

export async function postRoyaltyImportBatchAction(batchId: string): Promise<ActionResult> {
  await RequireAdminPermission("admin:royalties");
  if (!batchId) return { ok: false, error: "Batch id required." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_royalty_import_batch", {
    p_batch_id: batchId,
  });
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data };
}

export async function publishStatementAction(input: {
  ownerUserId: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:statements");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_royalty_statement", {
    p_owner_user_id: input.ownerUserId,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_currency: input.currency,
  });
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data };
}

export async function createSplitRuleAction(input: {
  ownerUserId: string;
  name: string;
  scopeType: "account" | "release" | "track" | "label";
  effectiveFrom: string;
  effectiveTo?: string;
  shares: SplitShareInput[];
  releaseId?: string;
  trackId?: string;
}): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:royalties");
  const check = validateSplitShares(input.shares);
  if (!check.ok) return { ok: false, error: check.reason ?? "Invalid shares" };
  const supabase = await createClient();
  const { data: rule, error } = await supabase
    .from("royalty_split_rules")
    .insert({
      owner_user_id: input.ownerUserId,
      name: input.name,
      scope_type: input.scopeType,
      scope_release_id: input.releaseId ?? null,
      scope_track_id: input.trackId ?? null,
      effective_from: input.effectiveFrom,
      effective_to: input.effectiveTo ?? null,
      review_status: "approved",
      is_active: true,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      created_by: ctx.userId,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  const { error: shareErr } = await supabase.from("royalty_split_shares").insert(
    input.shares.map((s) => ({
      rule_id: rule.id,
      party_name: s.partyName,
      party_role: s.partyRole,
      share_bps: s.shareBps,
      party_user_id: s.partyUserId ?? null,
      payee_id: s.payeeId ?? null,
    }))
  );
  if (shareErr) return { ok: false, error: shareErr.message };
  revalidateFinance();
  return { ok: true, data: rule };
}

export async function setComplianceHoldAction(input: {
  ownerUserId: string;
  reason: string;
  active: boolean;
  caseId?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:compliance");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_payout_compliance_hold", {
    p_owner_user_id: input.ownerUserId,
    p_reason: input.reason,
    p_case_id: input.caseId ?? null,
    p_active: input.active,
  });
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data };
}

export async function requestFinanceExportAction(input: {
  reportType: string;
  params?: Record<string, unknown>;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:reports");
  if (!isAllowedFinanceReportType(input.reportType)) {
    return { ok: false, error: "Report type not allowlisted." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const { data, error } = await supabase
    .from("report_exports")
    .insert({
      requested_by: user.id,
      report_type: input.reportType,
      params: input.params ?? {},
      status: "pending",
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/reports");
  return { ok: true, data };
}

export async function createPublishingWorkAction(input: {
  ownerUserId: string;
  title: string;
  iswc?: string;
  territories?: string[];
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:publishing");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("publishing_works")
    .insert({
      owner_user_id: input.ownerUserId,
      title: input.title,
      iswc: input.iswc ?? null,
      territories: input.territories ?? [],
      registration_status: "draft",
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data };
}

export async function addPublishingShareAction(input: {
  workId: string;
  partyId: string;
  rightType: PublishingRightType;
  shareBps: number;
  territory?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:publishing");
  const check = validatePublishingShares([
    {
      partyId: input.partyId,
      rightType: input.rightType,
      shareBps: input.shareBps,
      territory: input.territory ?? null,
    },
  ]);
  if (!check.ok) return { ok: false, error: check.reason ?? "Invalid share" };
  const supabase = await createClient();
  // Load existing to validate group total
  const { data: existing } = await supabase
    .from("publishing_shares")
    .select("party_id, right_type, share_bps, territory")
    .eq("work_id", input.workId)
    .eq("right_type", input.rightType);
  const all = [
    ...(existing ?? []).map((e) => ({
      partyId: e.party_id as string,
      rightType: e.right_type as PublishingRightType,
      shareBps: e.share_bps as number,
      territory: e.territory as string | null,
    })),
    {
      partyId: input.partyId,
      rightType: input.rightType,
      shareBps: input.shareBps,
      territory: input.territory ?? null,
    },
  ];
  const groupCheck = validatePublishingShares(all);
  if (!groupCheck.ok) return { ok: false, error: groupCheck.reason ?? "Shares exceed 100%" };

  const { data, error } = await supabase
    .from("publishing_shares")
    .insert({
      work_id: input.workId,
      party_id: input.partyId,
      right_type: input.rightType,
      share_bps: input.shareBps,
      territory: input.territory ?? null,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data };
}
