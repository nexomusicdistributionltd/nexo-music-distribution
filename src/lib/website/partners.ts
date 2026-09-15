import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WebsitePartner } from "./partner-types";

export type { WebsitePartner } from "./partner-types";
export { sortPartnersByOrder } from "./partner-types";

export async function listActivePartners(): Promise<WebsitePartner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("website_partners")
    .select("id, name, slug, logo_url, website_url, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("listActivePartners", error.message);
    return [];
  }
  return (data ?? []) as WebsitePartner[];
}

export async function listAllPartnersAdmin(): Promise<WebsitePartner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("website_partners")
    .select("id, name, slug, logo_url, website_url, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WebsitePartner[];
}
