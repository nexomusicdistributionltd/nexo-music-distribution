import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NEXO_EMAIL_SHELL_PATH } from "./brand";
import { composeFromShell, DEFAULT_CUSTOM_BODY } from "./compose";
import { listSeedTemplateSpecs } from "./seed-spec";
import type { StoredEmailTemplate } from "./types";

function repoRoot(): string {
  return process.cwd();
}

export async function readRepoHtml(relPath: string): Promise<string> {
  return fs.readFile(path.join(repoRoot(), relPath), "utf8");
}

export async function loadDarkShellHtml(): Promise<string> {
  return readRepoHtml(NEXO_EMAIL_SHELL_PATH);
}

export async function composeCustomFromShell(opts: {
  name: string;
  preheader?: string;
  bodyHtml?: string;
}): Promise<string> {
  const shell = await loadDarkShellHtml();
  return composeFromShell(shell, {
    bodyHtml: opts.bodyHtml?.trim() || DEFAULT_CUSTOM_BODY,
    preheader: opts.preheader ?? opts.name,
    title: opts.name,
  });
}

export async function tryLoadStoredTemplate(
  supabase: SupabaseClient,
  key: string
): Promise<Pick<StoredEmailTemplate, "html_body" | "subject" | "category" | "name"> | null> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("html_body, subject, category, name")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    // Table missing until migration is applied — fall back to catalog files.
    return null;
  }
  if (!data?.html_body) return null;
  return data as Pick<StoredEmailTemplate, "html_body" | "subject" | "category" | "name">;
}

/**
 * Insert catalog HTML into email_templates when the key is absent.
 * Never overwrites admin edits.
 */
export async function seedMissingEmailTemplates(
  supabase: SupabaseClient,
  createdBy?: string | null
): Promise<{ inserted: number; skipped: number; error?: string }> {
  const specs = listSeedTemplateSpecs();
  const { data: existing, error: listError } = await supabase
    .from("email_templates")
    .select("key");
  if (listError) {
    return { inserted: 0, skipped: 0, error: listError.message };
  }
  const have = new Set((existing ?? []).map((r) => r.key as string));
  let inserted = 0;
  let skipped = 0;
  for (const spec of specs) {
    if (have.has(spec.key)) {
      skipped += 1;
      continue;
    }
    let html: string;
    try {
      html = await readRepoHtml(spec.filePath);
    } catch (e) {
      return {
        inserted,
        skipped,
        error: `Failed to read ${spec.filePath}: ${e instanceof Error ? e.message : "read error"}`,
      };
    }
    const { error } = await supabase.from("email_templates").insert({
      key: spec.key,
      name: spec.name,
      category: spec.category,
      subject: spec.subject,
      html_body: html,
      created_by: createdBy ?? null,
    });
    if (error) {
      if (error.code === "23505") {
        skipped += 1;
        continue;
      }
      return { inserted, skipped, error: error.message };
    }
    inserted += 1;
  }
  return { inserted, skipped };
}
