import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertApprovedTemplateKey } from "./catalog";
import type { EnqueueEmailInput } from "./types";

/**
 * Server-side enqueue via SECURITY DEFINER RPC.
 * Idempotent on idempotency_key (ON CONFLICT DO NOTHING).
 * Never stores auth tokens in payload.
 */
export async function enqueueEmailEvent(
  supabase: SupabaseClient,
  input: EnqueueEmailInput
): Promise<{ id: string | null; enqueued: boolean; error?: string }> {
  const templateKey = assertApprovedTemplateKey(input.templateKey);
  const payload = scrubPayload(input.payload ?? {});

  const { data, error } = await supabase.rpc("enqueue_email_event", {
    p_event_type: input.eventType,
    p_template_key: templateKey,
    p_recipient_user_id: input.recipientUserId ?? null,
    p_recipient_email: input.recipientEmail ?? null,
    p_related_release_id: input.relatedReleaseId ?? null,
    p_related_entity_type: input.relatedEntityType ?? null,
    p_related_entity_id: input.relatedEntityId ?? null,
    p_payload: payload,
    p_idempotency_key: input.idempotencyKey,
    p_created_by: input.createdBy ?? null,
  });

  if (error) return { id: null, enqueued: false, error: error.message };
  // RPC returns uuid or null when conflict
  const id = (data as string | null) ?? null;
  return { id, enqueued: Boolean(id) };
}

const FORBIDDEN_PAYLOAD_KEYS = /token|password|secret|service_role|api[_-]?key|authorization|cookie/i;

export function scrubPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (FORBIDDEN_PAYLOAD_KEYS.test(k)) continue;
    if (typeof v === "string" && FORBIDDEN_PAYLOAD_KEYS.test(v) && v.length > 40) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

/** Map QC decision after successful RPC — enqueue only. */
export function qcDecisionIdempotencyKey(
  releaseId: string,
  decision: string,
  reviewId?: string | null
): string {
  const base = `RELEASE_QC:${releaseId}:${decision}`;
  return reviewId ? `${base}:${reviewId}` : base;
}
