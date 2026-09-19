import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCatalogEntry, isApprovedTemplateKey } from "./catalog";
import {
  payloadRecord,
  payloadString,
  templateVarsFromPayload,
  OUTBOUND_META,
  type OutboundEventRow,
} from "./outbound-meta";
import { defaultFromAddress, getEmailProvider } from "./provider";
import { loadTemplateHtml, renderHtmlDocument, renderTemplate } from "./render";
import { canMarkOutboundSent, type CanonicalEmailStatus } from "./status";
import { tryLoadStoredTemplate } from "./stored";
import type { TemplateKey } from "./types";

async function markStatus(
  supabase: SupabaseClient,
  id: string,
  status: CanonicalEmailStatus,
  opts?: { provider?: string; messageId?: string; error?: string }
) {
  const { error } = await supabase.rpc("mark_email_event_status", {
    p_id: id,
    p_status: status,
    p_provider: opts?.provider ?? null,
    p_provider_message_id: opts?.messageId ?? null,
    p_error: opts?.error ?? null,
  });
  if (error) throw new Error(error.message);
}


function firstText(...values: Array<string | number | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizedTemplateVars(
  row: OutboundEventRow,
  payload: Record<string, unknown>
): Record<string, string | number | null | undefined> {
  const vars = templateVarsFromPayload(payload);

  // Older call sites used semantically equivalent keys. Normalize them here so
  // an operational email never renders a blank reason/status/id block.
  if (!firstText(vars.REASON)) {
    vars.REASON =
      firstText(
        vars.QC_NOTES,
        vars.ARTIST_VISIBLE_REASON,
        vars.REPLY_BODY,
        vars.MESSAGE,
        vars.TICKET_SUBJECT,
        vars.CONTACT_SUBJECT
      ) ?? "";
  }
  if (!firstText(vars.STATUS)) {
    vars.STATUS =
      firstText(vars.ACCOUNT_STATUS, vars.STATUS_LABEL, vars.RELEASE_STATUS) ?? "";
  }
  if (
    !firstText(vars.RELEASE_ID) &&
    row.related_entity_type === "release" &&
    row.related_entity_id
  ) {
    vars.RELEASE_ID = row.related_entity_id;
  }
  if (
    !firstText(vars.SUPPORT_TICKET_ID) &&
    row.related_entity_type === "support_ticket" &&
    row.related_entity_id
  ) {
    vars.SUPPORT_TICKET_ID = row.related_entity_id;
  }

  const reason = firstText(vars.REASON) ?? "";
  if (row.template_key === "RELEASE_CHANGES_REQUIRED") {
    vars.CORRECTION_TITLE =
      firstText(vars.CORRECTION_TITLE) ?? "Changes required";
  }
  if (row.template_key === "RELEASE_CHANGES_REQUIRED" && /\bflac\b/i.test(reason)) {
    vars.CORRECTION_TITLE = "Audio File Requires Attention";
    vars.REQUIRED_FORMAT =
      firstText(vars.REQUIRED_FORMAT) ?? "FLAC (lossless audio)";
    vars.ACTION_REQUIRED =
      firstText(vars.ACTION_REQUIRED) ??
      "Replace the current audio file with a lossless FLAC file before resubmitting this release.";
    vars.RESUBMIT_INSTRUCTION =
      firstText(vars.RESUBMIT_INSTRUCTION) ??
      "Once the corrected FLAC file has been uploaded, resubmit the release and our team will review it again.";
  }

  return vars;
}

export function templateContractSatisfied(candidateHtml: string, canonicalHtml: string): boolean {
  const names = (html: string) =>
    new Set(
      [...html.matchAll(/\{\{[#/]?\s*([A-Z0-9_]+)\s*\}\}/g)].map(
        (match) => match[1]
      )
    );
  const candidate = names(candidateHtml);
  for (const required of names(canonicalHtml)) {
    if (!candidate.has(required)) return false;
  }
  return true;
}

async function canonicalSendRecipient(
  supabase: SupabaseClient,
  row: OutboundEventRow,
  payload: Record<string, unknown>
): Promise<string> {
  let recipientUserId = payloadString(payload, OUTBOUND_META.recipientUserId);
  const relatedReleaseId =
    row.related_entity_type === "release" && row.related_entity_id
      ? row.related_entity_id
      : payloadString(payload, OUTBOUND_META.relatedReleaseId);

  // Release lifecycle/QC messages are always resolved from the current release
  // owner. This also repairs legacy queued rows whose to_email was wrong.
  if (relatedReleaseId) {
    const { data: release, error: releaseError } = await supabase
      .from("releases")
      .select("owner_user_id")
      .eq("id", relatedReleaseId)
      .maybeSingle();
    if (releaseError || !release?.owner_user_id) {
      throw new Error("Could not resolve the affected release owner");
    }
    recipientUserId = release.owner_user_id;
  }

  // Any user-scoped transactional message follows the canonical profile email,
  // never an address copied from an admin form or stale outbox row.
  if (recipientUserId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", recipientUserId)
      .maybeSingle();
    const canonical = profile?.email?.trim();
    if (profileError || !canonical) {
      throw new Error("Could not resolve the affected user's email");
    }
    if (/[\r\n,;]/.test(canonical)) {
      throw new Error("Transactional email requires exactly one recipient");
    }
    return canonical;
  }

  const explicit = row.to_email?.trim();
  if (!explicit) throw new Error("Missing to_email");
  if (/[\r\n,;]/.test(explicit)) {
    throw new Error("Transactional email requires exactly one recipient");
  }
  return explicit;
}

/**
 * Process a single canonical outbox row. Never fabricates SENT.
 * Null provider → skipped; provider rejection → failed.
 * SENT only when the adapter accepts AND protect_email_outbound_sent would allow it.
 */
export async function processEmailEvent(
  supabase: SupabaseClient,
  eventId: string
): Promise<{ status: CanonicalEmailStatus; error?: string }> {
  const { data, error } = await supabase
    .from("email_outbound_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) return { status: "failed", error: error.message };
  if (!data) return { status: "failed", error: "Event not found" };

  const row = data as OutboundEventRow;
  if (row.status === "sent") return { status: "sent" };

  const payload = payloadRecord(row.payload);
  let to: string;
  try {
    to = await canonicalSendRecipient(supabase, row, payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Recipient resolution failed";
    await markStatus(supabase, row.id, "failed", { error: msg });
    return { status: "failed", error: msg };
  }

  const { data: suppression } = await supabase
    .from("email_suppressions")
    .select("reason")
    .eq("email", to.toLowerCase())
    .eq("active", true)
    .maybeSingle();
  if (suppression) {
    const reason = `Recipient suppressed: ${suppression.reason}`;
    await markStatus(supabase, row.id, "skipped", { error: reason });
    return { status: "skipped", error: reason };
  }

  const vars = normalizedTemplateVars(row, payload);
  let stored = await tryLoadStoredTemplate(supabase, row.template_key);
  const entry = getCatalogEntry(row.template_key);

  // Admin-edited operational templates are allowed, but they must still honor
  // the current canonical template contract. When the product adds required
  // metadata fields, a stale stored copy must not silently strip them.
  if (stored?.category === "ops" && entry?.filePath) {
    try {
      const canonicalHtml = await loadTemplateHtml(row.template_key);
      if (!templateContractSatisfied(stored.html_body, canonicalHtml)) {
        stored = null;
      }
    } catch {
      // Production serverless bundles may not contain repo-root HTML files.
      // A stored operational template is still authoritative and safe to render
      // from the database; do not discard it just because the filesystem copy
      // is unavailable.
    }
  }

  const payloadHtml = payloadString(payload, "html");
  const allowDormant =
    payload._allow_dormant === true || payloadString(payload, "_allow_dormant") === "true";
  if (entry?.dormant && !allowDormant) {
    await markStatus(supabase, row.id, "skipped", {
      error: entry.dormantReason ?? "Dormant template — waiting for a real provider event.",
    });
    return { status: "skipped", error: "Dormant template" };
  }

  if (!stored && !entry && !payloadHtml) {
    await markStatus(supabase, row.id, "failed", {
      error: `Unauthorized or unknown template key: ${row.template_key}`,
    });
    return { status: "failed", error: "Unauthorized template key" };
  }

  let html: string;
  let subject: string;
  try {
    if (stored?.html_body) {
      const rendered = renderHtmlDocument(stored.html_body, stored.subject, vars);
      html = rendered.html;
      subject = rendered.subject;
    } else if (isApprovedTemplateKey(row.template_key)) {
      const rendered = await renderTemplate(row.template_key as TemplateKey, vars);
      html = rendered.html;
      subject = rendered.subject;
    } else if (payloadHtml) {
      html = payloadHtml;
      subject = payloadString(payload, "subject") || row.template_key;
    } else {
      throw new Error(`No HTML body for template key: ${row.template_key}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Render failed";
    await markStatus(supabase, row.id, "failed", { error: msg });
    return { status: "failed", error: msg };
  }

  const provider = getEmailProvider();
  const result = await provider.send({
    to,
    subject,
    html,
    from: defaultFromAddress(),
    idempotencyKey: payloadString(payload, OUTBOUND_META.idempotencyKey) ?? row.id,
  });

  if (result.unavailable) {
    await markStatus(supabase, row.id, "skipped", {
      provider: result.provider,
      error: result.error ?? "Provider unavailable",
    });
    return { status: "skipped", error: result.error };
  }

  if (!result.accepted) {
    await markStatus(supabase, row.id, "failed", {
      provider: result.provider,
      error: result.error ?? "Provider rejected send",
    });
    return { status: "failed", error: result.error };
  }

  if (!canMarkOutboundSent(result.provider, result.messageId)) {
    await markStatus(supabase, row.id, "failed", {
      provider: result.provider,
      error:
        result.error ??
        "Provider accepted without a real provider identity and message id — not marking sent",
    });
    return {
      status: "failed",
      error: "Provider accepted without provider_message_id",
    };
  }

  await markStatus(supabase, row.id, "sent", {
    provider: result.provider,
    messageId: result.messageId,
  });
  return { status: "sent" };
}

export async function processPendingBatch(
  supabase: SupabaseClient,
  limit = 25
): Promise<{ processed: number; results: Array<{ id: string; status: CanonicalEmailStatus }> }> {
  const { data, error } = await supabase
    .from("email_outbound_events")
    .select("id")
    .in("status", ["queued", "skipped", "pending"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results: Array<{ id: string; status: CanonicalEmailStatus }> = [];
  for (const row of data ?? []) {
    const r = await processEmailEvent(supabase, row.id);
    results.push({ id: row.id, status: r.status });
  }
  return { processed: results.length, results };
}
