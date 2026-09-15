import { buildNewReleaseMessageXml } from "./builder";
import { buildCompatErnXml } from "./compat";
import type { DdexRuntimeConfig } from "./config";
import { mapCatalogToErn, DdexMappingError } from "./mapping";
import {
  buildDdexPackageFromParts,
  deliveryIdempotencyKey,
  nextRetryDelayMs,
  MAX_DELIVERY_ATTEMPTS,
} from "./package-builder";
import { assertLockedSenderForDelivery, ProductionDpidGuardError } from "./identity";
import { configForTarget, isTargetRuntimeConnected } from "./targets";
import { validateErnXml } from "./validate";
import { validateReleaseForDdexFromSnapshot, type DdexValidationReport } from "./validator";
import type {
  DdexCatalogSnapshot,
  DdexErnVersion,
  DdexMessageSubType,
  DdexPackageManifest,
  DspTargetRow,
  ErnMessageModel,
} from "./types";

export type GeneratedDdexRelease = {
  xml: string;
  model: ErnMessageModel;
  filename: string;
  messageId: string;
  messageThreadId: string;
  messageSubType: DdexMessageSubType;
  ernVersion: DdexErnVersion;
  validation: { ok: boolean; errors: string[] };
  report: DdexValidationReport;
};

export function resolveErnVersion(target?: DspTargetRow | null): DdexErnVersion {
  const v = target?.ern_version ?? "4.3.2";
  if (v === "4.3") return "4.3.2";
  return v;
}

export function generateDdexReleaseFromSnapshot(
  snapshot: DdexCatalogSnapshot,
  cfg: DdexRuntimeConfig,
  options?: {
    target?: DspTargetRow | null;
    messageId?: string;
    createdAt?: Date;
    messageThreadId?: string;
    messageSubType?: DdexMessageSubType;
    takedownDate?: string;
  }
): GeneratedDdexRelease {
  const target = options?.target ?? null;
  const runtime = target ? configForTarget(cfg, target) : cfg;
  const report = validateReleaseForDdexFromSnapshot(snapshot, runtime, target);
  if (!report.canGenerate) {
    throw new DdexMappingError(
      report.errors.length ? report.errors : ["Release is not DDEX-ready. Missing mandatory fields are never fabricated."]
    );
  }

  const messageSubType = options?.messageSubType ?? "Initial";
  const ernVersion = resolveErnVersion(target);
  const model = mapCatalogToErn(snapshot, runtime, {
    messageId: options?.messageId,
    createdAt: options?.createdAt,
    messageThreadId: options?.messageThreadId,
    messageSubType,
    takedownDate: options?.takedownDate,
  });

  const xml =
    ernVersion === "4.2" || ernVersion === "3.8.2"
      ? buildCompatErnXml(model, ernVersion)
      : buildNewReleaseMessageXml(model);

  const validation =
    ernVersion === "4.2" || ernVersion === "3.8.2"
      ? { ok: true, errors: [] as string[] }
      : validateErnXml(xml);

  return {
    xml,
    model,
    filename: model.header.messageFileName,
    messageId: model.header.messageId,
    messageThreadId: model.header.messageThreadId,
    messageSubType,
    ernVersion,
    validation,
    report,
  };
}

export function buildDdexPackageFromGenerated(
  generated: Pick<
    GeneratedDdexRelease,
    "xml" | "filename" | "messageId" | "messageSubType" | "ernVersion" | "validation"
  > & { createdAt?: string },
  snapshot: DdexCatalogSnapshot,
  releaseId: string,
  target: DspTargetRow
) {
  if (!generated.validation.ok) {
    throw new Error(`Cannot package invalid ERN: ${generated.validation.errors[0] ?? "XSD failed."}`);
  }
  return buildDdexPackageFromParts({
    releaseId,
    snapshot,
    xml: generated.xml,
    filename: generated.filename,
    messageId: generated.messageId,
    messageSubType: generated.messageSubType,
    ernVersion: generated.ernVersion,
    targetSlug: target.slug,
    createdAt: generated.createdAt,
  });
}

export function assertCanSendDelivery(input: {
  senderDpid: string | null | undefined;
  target: DspTargetRow;
  env?: NodeJS.ProcessEnv;
}): void {
  assertLockedSenderForDelivery(input.senderDpid);
  if (input.target.planning_only) {
    throw new Error("Target is a planning entry only (NOT CONNECTED). Commercial DSP delivery is not enabled.");
  }
  if (!isTargetRuntimeConnected(input.target, input.env)) {
    throw new Error("Target is NOT CONNECTED. Real credentials are required before delivery.");
  }
  if (!input.target.is_test && input.target.commercial_approval_required) {
    throw new Error(
      "Commercial DSP delivery is blocked until a real receiver DPID, credentials, and commercial approval exist. Stardust does not create DSP relationships."
    );
  }
}

export function queueStateFromExisting(existingDeliveryStatus: string | undefined): "reuse" | "queue" {
  if (
    existingDeliveryStatus === "queued" ||
    existingDeliveryStatus === "sending" ||
    existingDeliveryStatus === "delivered" ||
    existingDeliveryStatus === "acknowledged"
  ) {
    return "reuse";
  }
  return "queue";
}

export function retryAllowed(retryCount: number): boolean {
  return retryCount < MAX_DELIVERY_ATTEMPTS;
}

export function acknowledgmentPatch(reference: string, at = new Date().toISOString()) {
  return {
    delivery_status: "acknowledged" as const,
    acknowledged_at: at,
    ack_reference: reference,
  };
}

export {
  deliveryIdempotencyKey,
  nextRetryDelayMs,
  MAX_DELIVERY_ATTEMPTS,
  ProductionDpidGuardError,
};
export type { DdexPackageManifest };
