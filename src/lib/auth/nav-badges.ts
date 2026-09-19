import type { NavItem, NavSection } from "@/lib/auth/nav";

export type NavBadgeCounts = {
  routes: Record<string, number>;
  services: Record<string, number>;
};

export const EMPTY_NAV_BADGE_COUNTS: NavBadgeCounts = {
  routes: {},
  services: {},
};

function safeCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function countForItem(item: NavItem, counts: NavBadgeCounts): number {
  const routeCount = safeCount(counts.routes[item.href]);
  if (routeCount > 0) return routeCount;

  const serviceKind =
    "serviceKind" in item && typeof (item as NavItem & { serviceKind?: unknown }).serviceKind === "string"
      ? (item as NavItem & { serviceKind: string }).serviceKind
      : null;

  return serviceKind ? safeCount(counts.services[serviceKind]) : 0;
}

function decorateItem(item: NavItem, counts: NavBadgeCounts): NavItem {
  const count = countForItem(item, counts);
  return count > 0 ? { ...item, count } : { ...item, count: undefined };
}

export function applyNavBadgeCounts(
  sections: NavSection[],
  counts: NavBadgeCounts
): NavSection[] {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => decorateItem(item, counts)),
    ...(section.groups
      ? {
          groups: section.groups.map((group) =>
            group.map((item) => decorateItem(item, counts))
          ),
        }
      : {}),
  }));
}

export function navCountForHref(
  counts: NavBadgeCounts,
  href: string
): number {
  return safeCount(counts.routes[href]);
}
