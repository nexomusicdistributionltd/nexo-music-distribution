import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueEmailEvent } from "@/lib/email/enqueue";
import { processEmailEvent } from "@/lib/email/outbox";
import { isHostedAuthAutomation } from "@/lib/email/automations";
import type { EmailEventType } from "@/lib/email/types";

async function automationEnabled(
  supabase: SupabaseClient,
  key: string
): Promise<boolean> {
  if (isHostedAuthAutomation(key)) return false;
  const { data, error } = await supabase
    .from("email_automations")
    .select("enabled, hosted_by_supabase")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return false;
  if (data.hosted_by_supabase) return false;
  return Boolean(data.enabled);
}

/** Enqueue + attempt process. Never throws into the caller’s business transaction. */
export async function enqueueTransactionalEmail(opts: {
  supabase: SupabaseClient;
  templateKey: string;
  eventType: EmailEventType;
  to: string | null | undefined;
  recipientUserId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  relatedReleaseId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
  createdBy?: string | null;
  process?: boolean;
}): Promise<{ enqueued: boolean; id: string | null }> {
  try {
    const to = opts.to?.trim();
    if (!to) return { enqueued: false, id: null };
    const allowed = await automationEnabled(opts.supabase, opts.templateKey);
    if (!allowed) return { enqueued: false, id: null };
    const enq = await enqueueEmailEvent(opts.supabase, {
      eventType: opts.eventType,
      templateKey: opts.templateKey,
      recipientEmail: to,
      recipientUserId: opts.recipientUserId,
      relatedEntityType: opts.relatedEntityType,
      relatedEntityId: opts.relatedEntityId,
      relatedReleaseId: opts.relatedReleaseId,
      payload: opts.payload ?? {},
      idempotencyKey: opts.idempotencyKey,
      createdBy: opts.createdBy,
    });
    if (!enq.id) return { enqueued: false, id: null };
    if (opts.process !== false) {
      try {
        await processEmailEvent(opts.supabase, enq.id);
      } catch {
        /* stays queued */
      }
    }
    return { enqueued: true, id: enq.id };
  } catch {
    return { enqueued: false, id: null };
  }
}

/** Staff/service drain of queued outbox rows. Never invents SENT. */
export async function drainQueuedOutbox(limit = 10): Promise<void> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const { processPendingBatch } = await import("@/lib/email/outbox");
    const service = createServiceClient();
    await processPendingBatch(service, limit);
  } catch {
    /* SMTP / service role may be unavailable */
  }
}
