export type WebsitePartner = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  website_url: string | null;
  sort_order: number;
  is_active: boolean;
};

/** Pure sort helper for tests and UI. */
export function sortPartnersByOrder<T extends { sort_order: number; name: string }>(
  rows: T[]
): T[] {
  return [...rows].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );
}
