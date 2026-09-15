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
import { renderHtmlDocument, renderTemplate } from "./render";
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

  const to = row.to_email?.trim();
  if (!to) {
    await markStatus(supabase, row.id, "failed", {
      error: "Missing to_email",
    });
    return { status: "failed", error: "Missing to_email" };
  }

  const payload = payloadRecord(row.payload);
  const vars = templateVarsFromPayload(payload);
  const stored = await tryLoadStoredTemplate(supabase, row.template_key);
  const entry = getCatalogEntry(row.template_key);
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
