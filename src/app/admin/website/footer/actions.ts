"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";

const SECTIONS = new Set(["services", "company", "get_started", "legal"]);

function validHref(value: string): boolean {
  return value.startsWith("/") || value.startsWith("https://") || value.startsWith("http://");
}

export async function saveFooterLinkAction(input: {
  id?: string;
  sectionKey: string;
  label: string;
  href: string;
  sortOrder?: number;
  enabled: boolean;
  newTab: boolean;
}): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const ctx = await RequireAdminPermission("admin:settings");
  const sectionKey = input.sectionKey.trim();
  const label = input.label.trim();
  const href = input.href.trim();

  if (!SECTIONS.has(sectionKey)) return { ok: false, error: "Invalid footer section." };
  if (!label || label.length > 120) return { ok: false, error: "Link label is required." };
  if (!href || href.length > 1000 || !validHref(href)) {
    return { ok: false, error: "Use an internal /path or an http(s) URL." };
  }

  const db = createServiceClient();
  const payload = {
    section_key: sectionKey,
    label,
    href,
    sort_order: Number.isFinite(input.sortOrder)
      ? Math.max(0, Math.min(10000, Number(input.sortOrder)))
      : 100,
    enabled: input.enabled,
    new_tab: input.newTab,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? db.from("website_footer_links").update(payload).eq("id", input.id)
    : db.from("website_footer_links").insert({ ...payload, created_by: ctx.userId });
  const { data, error } = await query.select("id").single();

  if (error || !data) return { ok: false, error: error?.message || "Could not save footer link." };
  revalidatePath("/", "layout");
  revalidatePath("/admin/website/footer");
  return { ok: true, data: { id: data.id } };
}

export async function deleteFooterLinkAction(id: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  await RequireAdminPermission("admin:settings");
  const db = createServiceClient();
  const { error } = await db.from("website_footer_links").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/admin/website/footer");
  return { ok: true };
}
