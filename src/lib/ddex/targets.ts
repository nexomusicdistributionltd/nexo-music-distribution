import { TEST_TARGET_SLUG } from "./constants";
import type { DdexRuntimeConfig } from "./config";
import { compactDpid } from "./dpid";
import type { DdexProtocol, DspTargetPublic, DspTargetRow } from "./types";

export const COMMERCIAL_DSP_NAMES = [
  "Spotify",
  "Apple Music",
  "Amazon Music",
  "YouTube Music",
  "TikTok",
  "Deezer",
] as const;

function env(name: string, processEnv: NodeJS.ProcessEnv = process.env): string {
  return (processEnv[name] ?? "").trim();
}

export function protocolCredentialsPresent(
  protocol: DdexProtocol,
  prefix: string | null | undefined,
  processEnv: NodeJS.ProcessEnv = process.env
): boolean {
  const p = (prefix ?? "").trim();
  if (protocol === "local") return true;
  if (!p) return false;
  if (protocol === "ftp" || protocol === "sftp") {
    return Boolean(env(`${p}HOST`, processEnv) && env(`${p}USER`, processEnv) && env(`${p}PASSWORD`, processEnv));
  }
  if (protocol === "s3") {
    return Boolean(
      env(`${p}BUCKET`, processEnv) && env(`${p}ACCESS_KEY_ID`, processEnv) && env(`${p}SECRET_ACCESS_KEY`, processEnv)
    );
  }
  if (protocol === "rest") {
    return Boolean(env(`${p}ENDPOINT`, processEnv));
  }
  if (protocol === "azure") {
    return Boolean(env(`${p}CONNECTION_STRING`, processEnv) && env(`${p}CONTAINER`, processEnv));
  }
  return false;
}

export function isTargetRuntimeConnected(
  target: Pick<DspTargetRow, "protocol" | "is_active" | "is_test" | "planning_only" | "credential_env_prefix">,
  processEnv: NodeJS.ProcessEnv = process.env
): boolean {
  if (!target.is_active || target.planning_only) return false;
  if (target.protocol === "local" && target.is_test) return true;
  return protocolCredentialsPresent(target.protocol, target.credential_env_prefix, processEnv);
}

export function toPublicTarget(
  target: DspTargetRow,
  processEnv: NodeJS.ProcessEnv = process.env
): DspTargetPublic {
  return {
    id: target.id,
    slug: target.slug,
    displayName: target.display_name,
    protocol: target.protocol,
    ernVersion: target.ern_version,
    isTest: target.is_test,
    isActive: target.is_active,
    connected: isTargetRuntimeConnected(target, processEnv),
    commercialApprovalRequired: target.commercial_approval_required,
    planningOnly: target.planning_only,
    notes: target.notes,
  };
}

export function isForbiddenCommercialSeed(slug: string, displayName: string): boolean {
  const blob = `${slug} ${displayName}`.toLowerCase();
  return COMMERCIAL_DSP_NAMES.some((name) => blob.includes(name.toLowerCase()));
}

/**
 * Build sender/recipient config for a target.
 * Test targets loop back to Nexo's own DPID — never invent a DSP Party Id.
 */
export function configForTarget(base: DdexRuntimeConfig, target: DspTargetRow): DdexRuntimeConfig {
  if (target.is_test) {
    if (!base.senderPartyId) return base;
    return {
      ...base,
      recipientConfigKey: target.slug,
      recipientName: target.recipient_name || "Nexo Local Test Recipient",
      recipientDpidDisplay: base.senderDpidDisplay,
      recipientPartyId: base.senderPartyId,
      testRecipient: true,
      messageControlType: "TestMessage",
    };
  }

  const envKey = target.recipient_dpid_env_key?.trim();
  const fromEnv = envKey ? compactDpid(process.env[envKey]) : null;
  const recipientPartyId = fromEnv || base.recipientPartyId;
  const recipientDisplay = envKey
    ? (process.env[envKey] ?? "").trim() || base.recipientDpidDisplay
    : base.recipientDpidDisplay;

  return {
    ...base,
    recipientConfigKey: target.slug,
    recipientName: target.recipient_name || base.recipientName,
    recipientDpidDisplay: recipientDisplay,
    recipientPartyId,
    testRecipient: false,
  };
}

export function localTestTargetFixture(id = "target-local-test"): DspTargetRow {
  return {
    id,
    slug: TEST_TARGET_SLUG,
    display_name: "Nexo Local Test Target",
    protocol: "local",
    ern_version: "4.3.2",
    recipient_name: "Nexo Local Test Recipient",
    recipient_dpid_env_key: null,
    credential_env_prefix: "NEXO_DSP_TEST_",
    is_test: true,
    is_active: true,
    commercial_approval_required: false,
    planning_only: false,
    notes: "Isolated local/test delivery. Not a commercial DSP.",
  };
}
