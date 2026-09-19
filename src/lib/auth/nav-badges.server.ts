import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  EMPTY_NAV_BADGE_COUNTS,
  type NavBadgeCounts,
} from "@/lib/auth/nav-badges";

function normalizeRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) out[key] = Math.floor(n);
  }
  return out;
}

export async function getNavBadgeCounts(): Promise<NavBadgeCounts> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("nexo_nav_badge_counts");
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      return EMPTY_NAV_BADGE_COUNTS;
    }
    const row = data as { routes?: unknown; services?: unknown };
    return {
      routes: normalizeRecord(row.routes),
      services: normalizeRecord(row.services),
    };
  } catch {
    return EMPTY_NAV_BADGE_COUNTS;
  }
}
