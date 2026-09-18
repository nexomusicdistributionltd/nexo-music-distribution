import "server-only";

import type { WorkspaceKind, NavSection } from "@/lib/auth/nav";
import { createClient } from "@/lib/supabase/server";

export type PortalFeatureControl = {
  href: string;
  label: string;
  enabled_artist: boolean;
  enabled_label: boolean;
  admin_note: string | null;
};

export async function listPortalFeatureControls(): Promise<PortalFeatureControl[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("portal_feature_controls")
    .select("href,label,enabled_artist,enabled_label,admin_note")
    .order("href");
  if (error) return [];
  return (data ?? []) as PortalFeatureControl[];
}

export async function isPortalFeatureEnabled(
  href: string,
  kind: Exclude<WorkspaceKind, "admin">
): Promise<boolean> {
  const db = await createClient();
  const { data, error } = await db
    .from("portal_feature_controls")
    .select("enabled_artist,enabled_label")
    .eq("href", href)
    .maybeSingle();
  if (error || !data) return true;
  return kind === "label" ? Boolean(data.enabled_label) : Boolean(data.enabled_artist);
}

export function filterPortalSectionsByControls(
  sections: NavSection[],
  controls: PortalFeatureControl[],
  kind: Exclude<WorkspaceKind, "admin">
): NavSection[] {
  const byHref = new Map(controls.map((row) => [row.href, row]));
  const enabled = (href: string) => {
    const row = byHref.get(href);
    if (!row) return true;
    return kind === "label" ? row.enabled_label : row.enabled_artist;
  };

  return sections
    .map((section) => {
      const groups = section.groups?.map((group) => group.filter((item) => enabled(item.href)));
      const items = (groups?.flat() ?? section.items.filter((item) => enabled(item.href)));
      return { ...section, groups, items };
    })
    .filter((section) => section.items.length > 0);
}
