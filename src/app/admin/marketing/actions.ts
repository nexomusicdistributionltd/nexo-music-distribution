"use server";

import { revalidatePath } from "next/cache";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { marketingServiceSpec } from "@/lib/marketing/services";
import { parseHttpUrl } from "@/lib/dsp/profile-links";

const REQUEST_STATUSES = new Set([
  "submitted",
  "reviewing",
  "needs_info",
  "accepted",
  "approved",
  "processing",
  "live",
  "completed",
  "rejected",
  "cancelled",
]);

const REQUEST_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

function textValue(formData: FormData, key: string, max: number): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value.slice(0, max) : null;
}

function boolValue(formData: FormData, key: string): boolean {
  return String(formData.get(key) ?? "false") === "true";
}

function revalidateMarketing() {
  revalidatePath("/admin/marketing");
  revalidatePath("/marketing", "layout");
  revalidatePath("/dashboard", "layout");
}

export async function updateMarketingControlAction(formData: FormData) {
  const ctx = await RequireAdministrator();
  const kind = textValue(formData, "kind", 80);
  const spec = marketingServiceSpec(kind);
  if (!kind || !spec) return { ok: false as const, error: "Unknown marketing service." };

  const description = textValue(formData, "description", 1000);
  const adminInstructions = textValue(formData, "admin_instructions", 4000);
  const supabase = await createClient();
  const { error } = await supabase
    .from("marketing_service_controls")
    .update({
      enabled: boolValue(formData, "enabled"),
      accepting_requests: boolValue(formData, "accepting_requests"),
      requires_release: boolValue(formData, "requires_release"),
      description,
      admin_instructions: adminInstructions,
      updated_by: ctx.userId,
    })
    .eq("kind", kind);

  if (error) return { ok: false as const, error: "Marketing control could not be updated." };
  revalidateMarketing();
  return { ok: true as const };
}

export async function updateMarketingRequestAction(formData: FormData) {
  const ctx = await RequireAdministrator();
  const requestId = textValue(formData, "request_id", 80);
  const status = textValue(formData, "status", 40);
  const priority = textValue(formData, "priority", 20);

  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return { ok: false as const, error: "Invalid request." };
  }
  if (!status || !REQUEST_STATUSES.has(status)) {
    return { ok: false as const, error: "Invalid status." };
  }
  if (!priority || !REQUEST_PRIORITIES.has(priority)) {
    return { ok: false as const, error: "Invalid priority." };
  }

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("portal_service_requests")
    .select("id, kind")
    .eq("id", requestId)
    .maybeSingle();

  if (readError || !existing || !marketingServiceSpec(existing.kind)) {
    return { ok: false as const, error: "Marketing request was not found." };
  }

  const providerUrlRaw = textValue(formData, "provider_url", 2000);
  const parsedProviderUrl = providerUrlRaw ? parseHttpUrl(providerUrlRaw) : null;
  if (providerUrlRaw && (!parsedProviderUrl || parsedProviderUrl.protocol !== "https:")) {
    return { ok: false as const, error: "Provider reference URL must be a valid HTTPS URL." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("portal_service_requests")
    .update({
      status,
      priority,
      admin_note: textValue(formData, "admin_note", 4000),
      provider_state: textValue(formData, "provider_state", 160),
      provider_reference: textValue(formData, "provider_reference", 500),
      provider_url: parsedProviderUrl?.toString() ?? null,
      reviewed_by: ctx.userId,
      reviewed_at: now,
      completed_at: status === "completed" ? now : null,
    })
    .eq("id", requestId);

  if (error) return { ok: false as const, error: "Marketing request could not be updated." };

  revalidateMarketing();
  return { ok: true as const };
}
