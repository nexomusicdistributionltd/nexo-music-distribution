import fs from "node:fs/promises";
import path from "node:path";
import { assertApprovedTemplateKey, getCatalogEntry } from "./catalog";
import { sanitizeEmailVars } from "./sanitize";
import type { TemplateKey } from "./types";

const AUTH_FILE_MAP: Partial<Record<TemplateKey, string>> = {
  AUTH_CONFIRMATION: "supabase/templates/confirmation.html",
  AUTH_INVITE: "supabase/templates/invite.html",
  AUTH_MAGIC_LINK: "supabase/templates/magic_link.html",
  AUTH_RECOVERY: "supabase/templates/recovery.html",
  AUTH_EMAIL_CHANGE: "supabase/templates/email_change.html",
  AUTH_REAUTHENTICATION: "supabase/templates/reauthentication.html",
};

function repoRoot(): string {
  return process.cwd();
}

export async function loadTemplateHtml(templateKey: string): Promise<string> {
  const key = assertApprovedTemplateKey(templateKey);
  const entry = getCatalogEntry(key);
  if (!entry) throw new Error(`Unknown template key: ${key}`);

  const rel =
    entry.filePath ??
    AUTH_FILE_MAP[key] ??
    null;
  if (!rel) throw new Error(`No file path for template key: ${key}`);

  const full = path.join(repoRoot(), rel);
  return fs.readFile(full, "utf8");
}

/**
 * Substitute Go-less placeholders like {{RELEASE_TITLE}} with HTML-escaped values.
 * Unknown placeholders are left empty (stripped) for safety.
 */
export function substitutePlaceholders(
  html: string,
  vars: Record<string, string | number | null | undefined>
): string {
  const safe = sanitizeEmailVars(vars);
  return html.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_m, name: string) => {
    return safe[name] ?? "";
  });
}

export function renderHtmlDocument(
  htmlBody: string,
  subject: string,
  vars: Record<string, string | number | null | undefined>
): { html: string; subject: string } {
  return {
    html: substitutePlaceholders(htmlBody, vars),
    subject: substitutePlaceholders(subject, vars),
  };
}

export async function renderTemplate(
  templateKey: string,
  vars: Record<string, string | number | null | undefined>
): Promise<{ html: string; subject: string; dormant: boolean }> {
  const key = assertApprovedTemplateKey(templateKey);
  const entry = getCatalogEntry(key);
  if (!entry) throw new Error(`Unauthorized or unknown template key: ${key}`);
  const raw = await loadTemplateHtml(key);
  const rendered = renderHtmlDocument(raw, entry.subject, vars);
  return { ...rendered, dormant: Boolean(entry.dormant) };
}
