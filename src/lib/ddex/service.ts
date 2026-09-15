import "server-only";

import { applyDdexAcknowledgment } from "./acknowledgments";
import { ddexConfigErrors, readDdexConfig } from "./config";
import { DdexMappingError } from "./mapping";
import { TEST_TARGET_SLUG } from "./constants";
import {
  assertCanSendDelivery,
  buildDdexPackageFromGenerated,
  deliveryIdempotencyKey,
  generateDdexReleaseFromSnapshot,
  nextRetryDelayMs,
  queueStateFromExisting,
  retryAllowed,
} from "./pipeline";
import {
  downloadDdexXml,
  findMessageByIdempotency,
  getDdexMessage,
  getDspTarget,
  insertAcknowledgment,
  insertDeliveryAttempt,
  latestThreadMessage,
  listDspTargets,
  loadDdexSnapshot,
  persistDdexMessage,
  persistDdexPackage,
  storeValidationRun,
  updateDdexMessage,
} from "./persistence";
import { adapterForTarget } from "./protocols";
import { DDEX_PACKAGE_BUCKET } from "./package-builder";
import { createClient } from "@/lib/supabase/server";
import { configForTarget, isTargetRuntimeConnected, toPublicTarget } from "./targets";
import { validateReleaseForDdexFromSnapshot } from "./validator";
import type { DdexMessageSubType, DspTargetRow } from "./types";

async function resolveTarget(targetId?: string | null): Promise<DspTargetRow | null> {
  try {
    if (targetId) return getDspTarget(targetId);
    const targets = await listDspTargets();
    return targets.find((t) => t.slug === TEST_TARGET_SLUG && t.is_test) ?? targets.find((t) => t.is_test) ?? null;
  } catch {
    return null;
  }
}

export async function validateReleaseForDdex(releaseId: string, targetId?: string) {
  const cfg = readDdexConfig();
  const snapshot = await loadDdexSnapshot(releaseId);
  if (!snapshot) return { ok: false as const, error: "Release not found." };
  const target = await resolveTarget(targetId);
  const runtime = target ? configForTarget(cfg, target) : cfg;
  const report = validateReleaseForDdexFromSnapshot(snapshot, runtime, target);
  try {
    await storeValidationRun({
      releaseId,
      targetId: target?.id ?? null,
      canGenerate: report.canGenerate,
      report,
    });
  } catch {
    // Table may not exist until migration is applied; validation still returns in-memory.
  }
  return { ok: true as const, report, target: target ? toPublicTarget(target) : null };
}

async function generateForSubtype(
  releaseId: string,
  messageSubType: DdexMessageSubType,
  targetId?: string
) {
  const cfg = readDdexConfig();
  const snapshot = await loadDdexSnapshot(releaseId);
  if (!snapshot) return { ok: false as const, error: "Release not found." };
  const target = await resolveTarget(targetId);
  if (!target) {
    const cfgErrors = ddexConfigErrors(cfg);
    if (cfgErrors.length) return { ok: false as const, error: cfgErrors.join(" ") };
  }
  const runtime = target ? configForTarget(cfg, target) : cfg;
  const cfgErrors = ddexConfigErrors(runtime);
  if (cfgErrors.length) return { ok: false as const, error: cfgErrors.join(" ") };

  let messageThreadId: string | undefined;
  if ((messageSubType === "Update" || messageSubType === "Takedown") && target) {
    const prior = await latestThreadMessage(releaseId, target.id);
    if (!prior) {
      return {
        ok: false as const,
        error: `${messageSubType} requires a prior Initial message for this release and target.`,
      };
    }
    messageThreadId = prior.message_thread_id || prior.message_id;
  }

  let generated;
  try {
    generated = generateDdexReleaseFromSnapshot(snapshot, runtime, {
      target,
      messageSubType,
      messageThreadId,
    });
  } catch (e) {
    if (e instanceof DdexMappingError) {
      return { ok: false as const, error: e.errors.join(" "), report: undefined };
    }
    throw e;
  }

  const record = await persistDdexMessage({
    releaseId,
    messageId: generated.messageId,
    recipientConfigKey: runtime.recipientConfigKey,
    filename: generated.filename,
    xml: generated.xml,
    validationStatus: generated.validation.ok ? "valid" : "invalid",
    validationError: generated.validation.ok ? null : generated.validation.errors.join("\n"),
    targetId: target?.id ?? null,
    messageSubType,
    messageThreadId: generated.messageThreadId,
    ernVersion: generated.ernVersion,
    validationReport: generated.report,
  });

  if (!generated.validation.ok) {
    return {
      ok: false as const,
      error: `ERN built but official XSD validation failed. ${generated.validation.errors[0] ?? ""}`,
      message: record,
    };
  }

  return { ok: true as const, generated, record, snapshot, target, runtime };
}

export async function generateDdexRelease(releaseId: string, targetId?: string) {
  return generateForSubtype(releaseId, "Initial", targetId);
}

export async function generateDdexUpdate(releaseId: string, targetId?: string) {
  return generateForSubtype(releaseId, "Update", targetId);
}

export async function generateDdexTakedown(releaseId: string, targetId?: string) {
  return generateForSubtype(releaseId, "Takedown", targetId);
}

export async function buildDdexPackage(messageId: string) {
  const record = await getDdexMessage(messageId);
  if (!record) return { ok: false as const, error: "Message not found." };
  if (record.validation_status !== "valid") {
    return { ok: false as const, error: "Package requires a valid ERN (XSD pass)." };
  }
  const xml = await downloadDdexXml(record);
  if (!xml) return { ok: false as const, error: "ERN XML is not in private storage." };
  const snapshot = await loadDdexSnapshot(record.release_id);
  if (!snapshot) return { ok: false as const, error: "Release not found." };
  const target = record.target_id ? await getDspTarget(record.target_id) : await resolveTarget(null);
  if (!target) return { ok: false as const, error: "No DDEX target configured (safe test target required)." };

  const filename = record.filename || `${record.message_id}.xml`;
  try {
    const pkg = buildDdexPackageFromGenerated(
      {
        xml,
        filename,
        messageId: record.message_id,
        messageSubType: record.message_subtype ?? "Initial",
        ernVersion: (record.ern_version as "4.3.2") ?? "4.3.2",
        validation: { ok: true, errors: [] },
        createdAt: record.created_at,
      },
      snapshot,
      record.release_id,
      target
    );
    const stored = await persistDdexPackage({
      record,
      manifest: pkg.manifest,
      xml,
      filename,
    });
    return { ok: true as const, manifest: pkg.manifest, ...stored };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Package build failed." };
  }
}

export async function generateDdexPackage(releaseId: string, targetId?: string) {
  const generated = await generateDdexRelease(releaseId, targetId);
  if (!generated.ok) return generated;
  return buildDdexPackage(generated.record.message_id);
}

export async function queueDdexDelivery(messageId: string) {
  const record = await getDdexMessage(messageId);
  if (!record) return { ok: false as const, error: "Message not found." };
  if (record.validation_status !== "valid") {
    return { ok: false as const, error: "Queue requires a valid ERN." };
  }
  if (record.package_status !== "ready_for_delivery" && record.package_status !== "packaged") {
    const packed = await buildDdexPackage(messageId);
    if (!packed.ok) return packed;
  }
  const targetId = record.target_id;
  if (!targetId || !record.xml_sha256) {
    return { ok: false as const, error: "Queue requires a target and packaged XML hash." };
  }
  const key = deliveryIdempotencyKey({
    releaseId: record.release_id,
    targetId,
    messageSubType: record.message_subtype ?? "Initial",
    xmlSha256: record.xml_sha256,
  });
  const existing = await findMessageByIdempotency(key);
  if (existing && queueStateFromExisting(existing.delivery_status) === "reuse") {
    return { ok: true as const, message: existing, idempotent: true };
  }
  await updateDdexMessage(messageId, {
    delivery_status: "queued",
    queued_at: new Date().toISOString(),
    idempotency_key: key,
    package_status: "ready_for_delivery",
  });
  const updated = await getDdexMessage(messageId);
  return { ok: true as const, message: updated, idempotent: false };
}

export async function sendDdexDelivery(messageId: string) {
  const record = await getDdexMessage(messageId);
  if (!record) return { ok: false as const, error: "Message not found." };
  const cfg = readDdexConfig();
  const target = record.target_id ? await getDspTarget(record.target_id) : await resolveTarget(null);
  if (!target) return { ok: false as const, error: "No DDEX target configured." };

  try {
    assertCanSendDelivery({ senderDpid: cfg.senderDpidDisplay, target });
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Delivery blocked." };
  }

  const xml = await downloadDdexXml(record);
  if (!xml) return { ok: false as const, error: "ERN XML is not in private storage." };

  const attempt = (record.retry_count ?? 0) + 1;
  await updateDdexMessage(messageId, {
    delivery_status: "sending",
    last_attempt_at: new Date().toISOString(),
  });
  await insertDeliveryAttempt({
    messageId,
    attempt,
    protocol: target.protocol,
    status: "sending",
  });

  const supabase = await createClient();
  const adapter = adapterForTarget({
    protocol: target.protocol,
    connected: isTargetRuntimeConnected(target),
    isTest: target.is_test,
    prefix: target.credential_env_prefix,
    put: async (path, body, contentType) => {
      const { error } = await supabase.storage.from(DDEX_PACKAGE_BUCKET).upload(path, body, {
        contentType,
        upsert: true,
      });
      if (error) throw new Error("Failed to write local test delivery package.");
    },
  });

  try {
    const result = await adapter.deliver({
      manifest: {
        messageId: record.message_id,
        messageSubType: record.message_subtype ?? "Initial",
        ernVersion: record.ern_version,
        releaseId: record.release_id,
        upc: "",
        targetSlug: target.slug,
        createdAt: new Date().toISOString(),
        xmlSha256: record.xml_sha256 || "",
        files: [],
      },
      xml,
      filename: record.filename || `${record.message_id}.xml`,
    });
    if (!result.delivered) {
      throw new Error(result.reason || "Delivery did not complete.");
    }
    await insertDeliveryAttempt({
      messageId,
      attempt,
      protocol: target.protocol,
      status: "delivered",
    });
    await updateDdexMessage(messageId, {
      delivery_status: "delivered",
      delivered_at: new Date().toISOString(),
      ack_reference: result.acknowledgmentId ?? null,
      error: null,
    });
    return { ok: true as const, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delivery failed.";
    await insertDeliveryAttempt({
      messageId,
      attempt,
      protocol: target.protocol,
      status: "failed",
      error: message,
    });
    await updateDdexMessage(messageId, {
      delivery_status: "failed",
      retry_count: attempt,
      next_retry_at: new Date(Date.now() + nextRetryDelayMs(attempt - 1)).toISOString(),
      error: message.slice(0, 4000),
    });
    return { ok: false as const, error: message, retryAllowed: retryAllowed(attempt) };
  }
}

export async function retryDdexDelivery(messageId: string) {
  const record = await getDdexMessage(messageId);
  if (!record) return { ok: false as const, error: "Message not found." };
  if (!retryAllowed(record.retry_count ?? 0)) {
    return { ok: false as const, error: "Maximum delivery attempts reached." };
  }
  const queued = await queueDdexDelivery(messageId);
  if (!queued.ok) return queued;
  return sendDdexDelivery(messageId);
}

export async function processDdexAcknowledgment(messageId: string, reference: string) {
  const record = await getDdexMessage(messageId);
  if (!record) return { ok: false as const, error: "Message not found." };
  try {
    const patch = applyDdexAcknowledgment(record, reference);
    await insertAcknowledgment({ messageId, ackReference: reference });
    await updateDdexMessage(messageId, patch);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Acknowledgment failed." };
  }
}

export async function listPublicDspTargets() {
  const rows = await listDspTargets();
  return rows.map((row) => toPublicTarget(row));
}
