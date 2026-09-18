import "server-only";

import { createClient } from "@/lib/supabase/server";

export type FooterSectionKey = "services" | "company" | "get_started" | "legal";

export type FooterLink = {
  id?: string;
  section_key: FooterSectionKey;
  label: string;
  href: string;
  sort_order: number;
  enabled: boolean;
  new_tab: boolean;
};

export const DEFAULT_FOOTER_LINKS: FooterLink[] = [
  { section_key: "services", label: "Distribution", href: "/distribution", sort_order: 10, enabled: true, new_tab: false },
  { section_key: "services", label: "Publishing", href: "/publishing", sort_order: 20, enabled: true, new_tab: false },
  { section_key: "services", label: "Services", href: "/services", sort_order: 30, enabled: true, new_tab: false },
  { section_key: "services", label: "For Artists", href: "/artists", sort_order: 40, enabled: true, new_tab: false },
  { section_key: "services", label: "For Labels", href: "/labels", sort_order: 50, enabled: true, new_tab: false },
  { section_key: "company", label: "Terms", href: "/terms", sort_order: 10, enabled: true, new_tab: false },
  { section_key: "company", label: "Privacy", href: "/privacy", sort_order: 20, enabled: true, new_tab: false },
  { section_key: "company", label: "Contact", href: "/contact", sort_order: 30, enabled: true, new_tab: false },
  { section_key: "company", label: "Pricing", href: "/pricing", sort_order: 40, enabled: true, new_tab: false },
  { section_key: "get_started", label: "Apply now", href: "/register", sort_order: 10, enabled: true, new_tab: false },
  { section_key: "get_started", label: "Sign in", href: "/login", sort_order: 20, enabled: true, new_tab: false },
  { section_key: "get_started", label: "Get Started", href: "/get-started", sort_order: 30, enabled: true, new_tab: false },
  { section_key: "get_started", label: "Support", href: "/faq", sort_order: 40, enabled: true, new_tab: false },
  { section_key: "legal", label: "Privacy Policy", href: "/privacy", sort_order: 10, enabled: true, new_tab: false },
  { section_key: "legal", label: "Terms of Service", href: "/terms", sort_order: 20, enabled: true, new_tab: false },
  { section_key: "legal", label: "Refund Policy", href: "/refund-policy", sort_order: 30, enabled: true, new_tab: false },
  { section_key: "legal", label: "Cookie Policy", href: "/cookies", sort_order: 40, enabled: true, new_tab: false },
];

export async function listFooterLinks(options?: { includeDisabled?: boolean }): Promise<FooterLink[]> {
  try {
    const db = await createClient();
    let query = db
      .from("website_footer_links")
      .select("id,section_key,label,href,sort_order,enabled,new_tab")
      .order("section_key")
      .order("sort_order")
      .order("created_at");
    if (!options?.includeDisabled) query = query.eq("enabled", true);
    const { data, error } = await query;
    if (error || !data?.length) return DEFAULT_FOOTER_LINKS.filter((row) => options?.includeDisabled ? true : row.enabled);
    return data as FooterLink[];
  } catch {
    return DEFAULT_FOOTER_LINKS.filter((row) => options?.includeDisabled ? true : row.enabled);
  }
}

export function groupFooterLinks(rows: FooterLink[]): Record<FooterSectionKey, FooterLink[]> {
  const grouped: Record<FooterSectionKey, FooterLink[]> = {
    services: [],
    company: [],
    get_started: [],
    legal: [],
  };
  for (const row of rows) grouped[row.section_key]?.push(row);
  return grouped;
}
