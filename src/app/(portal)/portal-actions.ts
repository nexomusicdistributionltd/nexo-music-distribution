"use server";

import { revalidatePath } from "next/cache";
import { RequireRole, assertCanMutateCatalog } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { publicErrorMessage } from "@/lib/http/safe-error";
import { RATE_LIMITS, checkRateLimit } from "@/lib/security/rate-limit";
import {
  validateMemberInput,
  validatePayeeInput,
  validatePayoutRequestInput,
  validateRecoupmentInput,
  validateServiceRequestInput,
  validateSplitCreateInput,
  validateTaxInput,
  validateVideoInput,
} from "@/lib/portal/validate";
import type { SplitShareInput } from "@/lib/finance/splits";

export type PortalActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requirePortal() {
  return RequireRole(["artist", "label"]);
}

function revalidatePortal() {
  revalidatePath("/dashboard");
  revalidatePath("/catalog", "layout");
  revalidatePath("/marketing", "layout");
  revalidatePath("/analytics", "layout");
  revalidatePath("/rights", "layout");
  revalidatePath("/help", "layout");
  revalidatePath("/splitshare", "layout");
  revalidatePath("/account", "layout");
  revalidatePath("/earnings", "layout");
  revalidatePath("/dashboard/videos");
}

export async function createServiceRequestAction(input: {
  kind: string;
  title: string;
  body?: string;
  related_url?: string;
  release_id?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const rl = checkRateLimit({ key: `portal:svc:${ctx.userId}`, ...RATE_LIMITS.portalRequest });
  if (!rl.ok) return { ok: false, error: "Too many requests. Try again later." };
  const parsed = validateServiceRequestInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portal_service_requests")
    .insert({
      owner_user_id: ctx.userId,
      kind: parsed.kind,
      title: parsed.title,
      body: parsed.body,
      related_url: parsed.url,
      release_id: input.release_id || null,
      status: "submitted",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePortal();
  return { ok: true, data: { id: data.id } };
}

export async function createMusicVideoAction(input: {
  title: string;
  video_url: string;
  notes?: string;
  release_id?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const rl = checkRateLimit({ key: `portal:video:${ctx.userId}`, ...RATE_LIMITS.portalRequest });
  if (!rl.ok) return { ok: false, error: "Too many requests. Try again later." };
  const parsed = validateVideoInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("music_video_submissions")
    .insert({
      owner_user_id: ctx.userId,
      title: parsed.title,
      video_url: parsed.url,
      notes: parsed.notes,
      release_id: input.release_id || null,
      status: "submitted",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/dashboard/videos");
  return { ok: true, data: { id: data.id } };
}

export async function createPayeeAction(input: {
  name: string;
  email?: string;
  role_label?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  const parsed = validatePayeeInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portal_payees")
    .insert({
      owner_user_id: ctx.userId,
      name: parsed.name,
      email: parsed.email,
      role_label: parsed.role_label,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/splitshare/payees");
  return { ok: true, data: { id: data.id } };
}

export async function createSplitRuleAction(input: {
  name: string;
  shares: SplitShareInput[];
  effectiveFrom?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  const parsed = validateSplitCreateInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data: rule, error } = await supabase
    .from("royalty_split_rules")
    .insert({
      owner_user_id: ctx.userId,
      name: parsed.name,
      scope_type: "account",
      effective_from: parsed.effectiveFrom,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  const { error: shareError } = await supabase.from("royalty_split_shares").insert(
    parsed.shares.map((s) => ({
      rule_id: rule.id,
      party_name: s.partyName.trim(),
      party_role: s.partyRole,
      share_bps: s.shareBps,
      party_user_id: s.partyUserId ?? null,
    }))
  );
  if (shareError) return { ok: false, error: publicErrorMessage(shareError.message) };
  revalidatePath("/earnings/splits");
  return { ok: true, data: { id: rule.id } };
}

export async function assignSplitToTrackAction(input: {
  track_id: string;
  split_rule_id: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  if (!input.track_id || !input.split_rule_id) return { ok: false, error: "Track and split are required." };
  const supabase = await createClient();
  const { data: track } = await supabase
    .from("release_tracks")
    .select("id, releases!inner(owner_user_id)")
    .eq("id", input.track_id)
    .eq("releases.owner_user_id", ctx.userId)
    .maybeSingle();
  if (!track) return { ok: false, error: "Track not found." };
  const { data: rule } = await supabase
    .from("royalty_split_rules")
    .select("id")
    .eq("id", input.split_rule_id)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!rule) return { ok: false, error: "Split rule not found." };
  const { data, error } = await supabase
    .from("split_track_assignments")
    .upsert(
      {
        owner_user_id: ctx.userId,
        track_id: input.track_id,
        split_rule_id: input.split_rule_id,
      },
      { onConflict: "track_id" }
    )
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/splitshare/assignments");
  return { ok: true, data: { id: data.id } };
}

export async function createRecoupmentAction(input: {
  title: string;
  amountMinor: number;
  currency?: string;
  notes?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  const parsed = validateRecoupmentInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portal_recoupments")
    .insert({
      owner_user_id: ctx.userId,
      title: parsed.title,
      amount_minor: parsed.amountMinor,
      currency: parsed.currency,
      notes: input.notes?.trim() || null,
      status: "open",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/splitshare/recoupments");
  return { ok: true, data: { id: data.id } };
}

export async function inviteAccountMemberAction(input: {
  email: string;
  display_name?: string;
  role_label?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  if (!ctx.roles.includes("label")) {
    return { ok: false, error: "Account members are managed on label accounts." };
  }
  const parsed = validateMemberInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_members")
    .insert({
      owner_user_id: ctx.userId,
      email: parsed.email,
      display_name: parsed.display_name,
      role_label: parsed.role_label,
      status: "invited",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/account/members");
  return { ok: true, data: { id: data.id } };
}

export async function saveTaxDetailsAction(input: {
  legal_name?: string;
  country?: string;
  tax_id?: string;
}): Promise<PortalActionResult> {
  const ctx = await requirePortal();
  const parsed = validateTaxInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { error } = await supabase.from("account_tax_details").upsert({
    owner_user_id: ctx.userId,
    legal_name: parsed.legal_name,
    country: parsed.country,
    tax_id: parsed.tax_id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/account/payment-tax");
  return { ok: true, data: true };
}

export async function requestEnrollmentAction(service_key: string): Promise<PortalActionResult> {
  const ctx = await requirePortal();
  const key = service_key.trim().slice(0, 80);
  if (!key) return { ok: false, error: "Service required." };
  const supabase = await createClient();
  const { error } = await supabase.from("account_enrollments").insert({
    owner_user_id: ctx.userId,
    service_key: key,
    status: "requested",
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: true, data: true };
    return { ok: false, error: publicErrorMessage(error.message) };
  }
  revalidatePath("/account/enrollments");
  return { ok: true, data: true };
}

export async function createPayoutRequestAction(input: {
  amountMinor: number;
  currency?: string;
  method_note?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  const rl = checkRateLimit({ key: `payout:req:${ctx.userId}`, ...RATE_LIMITS.payoutCreate });
  if (!rl.ok) return { ok: false, error: "Too many payout requests." };
  const parsed = validatePayoutRequestInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data: bal } = await supabase
    .from("ledger_balances")
    .select("available_minor, currency")
    .eq("owner_user_id", ctx.userId)
    .eq("currency", parsed.currency)
    .maybeSingle();
  if (!bal || Number(bal.available_minor) < parsed.amountMinor) {
    return { ok: false, error: "Insufficient available balance for this request." };
  }
  const { data, error } = await supabase
    .from("payout_requests")
    .insert({
      owner_user_id: ctx.userId,
      amount_minor: parsed.amountMinor,
      currency: parsed.currency,
      method_note: input.method_note?.trim() || null,
      status: "submitted",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/earnings/payouts");
  return { ok: true, data: { id: data.id } };
}
