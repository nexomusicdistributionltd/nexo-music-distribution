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

function fail(message: string): never {
  throw new Error(message);
}

function revalidateMarketing() {
  revalidatePath("/admin/marketing");
  revalidatePath("/marketing", "layout");
  revalidatePath("/dashboard", "layout");
}

export async function updateMarketingControlAction(formData: FormData): Promise<void> {
  const ctx = await RequireAdministrator();
  const kind = textValue(formData, "kind", 80);
  const spec = marketingServiceSpec(kind);
  if (!kind || !spec) fail("Unknown marketing service.");

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

  if (error) fail("Marketing control could not be updated.");
  revalidateMarketing();
  return;
}

export async function updateMarketingRequestAction(formData: FormData): Promise<void> {
  const ctx = await RequireAdministrator();
  const requestId = textValue(formData, "request_id", 80);
  const status = textValue(formData, "status", 40);
  const priority = textValue(formData, "priority", 20);

  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    fail("Invalid request.");
  }
  if (!status || !REQUEST_STATUSES.has(status)) {
    fail("Invalid status.");
  }
  if (!priority || !REQUEST_PRIORITIES.has(priority)) {
    fail("Invalid priority.");
  }

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("portal_service_requests")
    .select("id, kind")
    .eq("id", requestId)
    .maybeSingle();

  if (readError || !existing || !marketingServiceSpec(existing.kind)) {
    fail("Marketing request was not found.");
  }

  const providerUrlRaw = textValue(formData, "provider_url", 2000);
  const parsedProviderUrl = providerUrlRaw ? parseHttpUrl(providerUrlRaw) : null;
  if (providerUrlRaw && (!parsedProviderUrl || parsedProviderUrl.protocol !== "https:")) {
    fail("Provider reference URL must be a valid HTTPS URL.");
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

  if (error) fail("Marketing request could not be updated.");

  revalidateMarketing();
  return;
}

const MARKETING_CONTENT_SLUGS = new Set(["client-offerings", "marketing-best-practices"]);

export async function updateMarketingContentAction(formData: FormData): Promise<void> {
  const ctx = await RequireAdministrator();
  const slug = textValue(formData, "slug", 100);
  if (!slug || !MARKETING_CONTENT_SLUGS.has(slug)) {
    fail("Unknown marketing content page.");
  }

  const title = textValue(formData, "title", 200);
  const summary = textValue(formData, "summary", 1000);
  if (!title || !summary) {
    fail("Title and summary are required.");
  }

  const headings = formData
    .getAll("section_heading")
    .map((value) => String(value).trim().slice(0, 200));
  const bodies = formData
    .getAll("section_body")
    .map((value) => String(value).trim().slice(0, 5000));
  const sections = headings
    .map((heading, index) => ({ heading, body: bodies[index] ?? "" }))
    .filter((section) => section.heading && section.body);

  if (sections.length === 0) {
    fail("Add at least one complete content section.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("marketing_content_pages")
    .update({
      title,
      summary,
      sections,
      enabled: boolValue(formData, "enabled"),
      updated_by: ctx.userId,
    })
    .eq("slug", slug);

  if (error) fail("Marketing content could not be updated.");

  revalidateMarketing();
  revalidatePath("/help", "layout");
  return;
}
