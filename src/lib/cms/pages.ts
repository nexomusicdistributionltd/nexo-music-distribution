import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getPublishedPageBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cms_pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    console.error("getPublishedPageBySlug", error.message);
    return null;
  }
  return data;
}

export async function listAllPagesAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cms_pages")
    .select("id, slug, title, status, page_kind, updated_at, published_at")
    .order("page_kind", { ascending: true })
    .order("slug", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getPageAdmin(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cms_pages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function legalHrefForSlug(slug: string): string {
  if (slug === "privacy") return "/privacy";
  if (slug === "terms") return "/terms";
  if (slug === "cookies") return "/cookies";
  if (slug === "return-policy" || slug === "refund-policy") return "/refund-policy";
  if (slug === "contact") return "/contact";
  if (slug === "pricing") return "/pricing";
  return `/pages/${slug}`;
}
