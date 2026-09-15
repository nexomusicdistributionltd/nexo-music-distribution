import { EMAIL_CATALOG } from "./catalog";
import type { StoredTemplateCategory } from "./types";

export type SeedTemplateSpec = {
  key: string;
  name: string;
  category: StoredTemplateCategory;
  subject: string;
  filePath: string;
};

function humanizeKey(key: string): string {
  return key
    .replace(/^AUTH_/, "")
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function categoryForCatalogKey(eventType: string): StoredTemplateCategory {
  if (eventType === "newsletter") return "newsletter";
  return "ops";
}

function displayNameForKey(key: string): string {
  if (key === "NEW_MUSIC_FRIDAY") return "New Music Friday";
  if (key === "NEWSLETTER") return "Newsletter";
  return humanizeKey(key);
}

/** Filesystem sources to upsert into email_templates when missing. Auth Go templates are skipped. */
export function listSeedTemplateSpecs(): SeedTemplateSpec[] {
  const extra: SeedTemplateSpec[] = [];
  for (const entry of EMAIL_CATALOG) {
    if (!entry.filePath) continue;
    extra.push({
      key: entry.templateKey,
      name: displayNameForKey(entry.templateKey),
      category: categoryForCatalogKey(entry.eventType),
      subject: entry.subject,
      filePath: entry.filePath,
    });
  }
  return extra;
}
