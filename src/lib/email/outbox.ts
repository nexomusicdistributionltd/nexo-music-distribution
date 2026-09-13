import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCatalogEntry } from "./catalog";
import { defaultFromAddress, getEmailProvider } from "./provider";
import { renderTemplate } from "./render";
import type { EmailEventStatus, TemplateKey } from "./types";

type EmailEventRow = {
  id: string;
  event_type: string;
  template_key: string;
  recipient_user_id: string | null;
  recipient_email: string | null;
  related_release_id: string | null;
  payload: Record<string, unknown>;
  status: EmailEventStatus;
  idempotency_key: string;
  attempt_count: number;
};

async function markStatus(
  supabase: SupabaseClient,
  id: string,
  status: EmailEventStatus,
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
 * Process a single outbox row. Never fabricates SENT.
 * Null provider → UNAVAILABLE; provider rejection → FAILED.
 */
export async function processEmailEvent(
  supabase: SupabaseClient,
  eventId: string
): Promise<{ status: EmailEventStatus; error?: string }> {
  const { data, error } = await supabase
    .from("email_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) return { status: "failed", error: error.message };
  if (!data) return { status: "failed", error: "Event not found" };

  const row = data as EmailEventRow;
  if (row.status === "sent") return { status: "sent" };

  const entry = getCatalogEntry(row.template_key);
  if (!entry) {
    await markStatus(supabase, row.id, "failed", {
      error: `Unauthorized template key: ${row.template_key}`,
    });
    return { status: "failed", error: "Unauthorized template key" };
  }

  const to = row.recipient_email?.trim();
  if (!to) {
    await markStatus(supabase, row.id, "failed", {
      error: "Missing recipient_email",
    });
    return { status: "failed", error: "Missing recipient_email" };
  }

  await markStatus(supabase, row.id, "processing");

  const vars = {
    ...(typeof row.payload === "object" && row.payload ? row.payload : {}),
  } as Record<string, string | number | null | undefined>;

  let html: string;
  let subject: string;
  try {
    const rendered = await renderTemplate(row.template_key as TemplateKey, vars);
    html = rendered.html;
    subject = rendered.subject;
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
    idempotencyKey: row.idempotency_key,
  });

  if (result.unavailable) {
    await markStatus(supabase, row.id, "unavailable", {
      provider: result.provider,
      error: result.error ?? "Provider unavailable",
    });
    return { status: "unavailable", error: result.error };
  }

  if (!result.accepted) {
    await markStatus(supabase, row.id, "failed", {
      provider: result.provider,
      error: result.error ?? "Provider rejected send",
    });
    return { status: "failed", error: result.error };
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
): Promise<{ processed: number; results: Array<{ id: string; status: EmailEventStatus }> }> {
  const { data, error } = await supabase
    .from("email_events")
    .select("id")
    .in("status", ["pending", "unavailable"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results: Array<{ id: string; status: EmailEventStatus }> = [];
  for (const row of data ?? []) {
    const r = await processEmailEvent(supabase, row.id);
    results.push({ id: row.id, status: r.status });
  }
  return { processed: results.length, results };
}
