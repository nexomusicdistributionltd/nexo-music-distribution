export type AdminSearchEntity =
  | "release"
  | "artist"
  | "label"
  | "user"
  | "ticket"
  | "contact"
  | "compliance";

export function sanitizeAdminSearchQuery(raw: string | null | undefined): string {
  if (!raw) return "";
  // Strip PostgREST .or() metacharacters so commas cannot introduce extra filters.
  return raw.replace(/[%_,()."'\\:*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function parseAdminSearchEntities(
  raw: string | null | undefined
): AdminSearchEntity[] {
  const all: AdminSearchEntity[] = [
    "release",
    "artist",
    "label",
    "user",
    "ticket",
    "contact",
    "compliance",
  ];
  if (!raw || raw === "all") return all;
  const set = new Set(raw.split(",").map((s) => s.trim()));
  return all.filter((e) => set.has(e));
}
