import "server-only";

import {
  AVS_VERSION_ID,
  ERN_NAMESPACE,
  ERN_VERSION,
  NEXO_SENDER_NAME,
  RELEASE_PROFILE_VERSION_ID,
  getNexoDpid,
} from "./constants";
import { compactDpid } from "./dpid";

export type DdexMessageControlType = "LiveMessage" | "TestMessage";

export type DdexRuntimeConfig = {
  ernVersion: typeof ERN_VERSION;
  ernNamespace: typeof ERN_NAMESPACE;
  avsVersionId: typeof AVS_VERSION_ID;
  releaseProfileVersionId: typeof RELEASE_PROFILE_VERSION_ID;
  senderName: string;
  senderDpidDisplay: string | null;
  senderPartyId: string | null;
  recipientConfigKey: string;
  recipientName: string | null;
  recipientDpidDisplay: string | null;
  recipientPartyId: string | null;
  testRecipient: boolean;
  messageControlType: DdexMessageControlType;
  proprietaryNamespace: string | null;
};

function trim(v: string | undefined | null): string {
  return (v ?? "").trim();
}

/**
 * Server-only DDEX identity + recipient configuration.
 * Recipient DPID is never defaulted to Spotify/Apple or any invented DSP.
 * A test recipient is used only when NEXO_DDEX_TEST_RECIPIENT is explicitly true
 * and a recipient DPID is configured.
 */
export function readDdexConfig(env: NodeJS.ProcessEnv = process.env): DdexRuntimeConfig {
  const senderDisplay = trim(env.NEXO_DPID) || getNexoDpid();
  const senderPartyId = compactDpid(senderDisplay);
  const recipientDisplay = trim(env.NEXO_DDEX_RECIPIENT_DPID) || null;
  const recipientPartyId = compactDpid(recipientDisplay);
  const testRecipient = trim(env.NEXO_DDEX_TEST_RECIPIENT).toLowerCase() === "true";
  const controlRaw = trim(env.NEXO_DDEX_MESSAGE_CONTROL);
  const messageControlType: DdexMessageControlType =
    controlRaw === "LiveMessage" && !testRecipient ? "LiveMessage" : "TestMessage";

  return {
    ernVersion: ERN_VERSION,
    ernNamespace: ERN_NAMESPACE,
    avsVersionId: AVS_VERSION_ID,
    releaseProfileVersionId: RELEASE_PROFILE_VERSION_ID,
    senderName: trim(env.NEXO_DDEX_SENDER_NAME) || NEXO_SENDER_NAME,
    senderDpidDisplay: senderDisplay || null,
    senderPartyId,
    recipientConfigKey: trim(env.NEXO_DDEX_RECIPIENT_KEY) || (testRecipient ? "test" : "configured"),
    recipientName: trim(env.NEXO_DDEX_RECIPIENT_NAME) || null,
    recipientDpidDisplay: recipientDisplay,
    recipientPartyId,
    testRecipient,
    messageControlType,
    proprietaryNamespace: senderPartyId,
  };
}

export function ddexConfigErrors(cfg: DdexRuntimeConfig): string[] {
  const errors: string[] = [];
  if (!cfg.senderPartyId) {
    errors.push("NEXO_DPID is missing or is not a valid DPID.");
  }
  if (!cfg.recipientPartyId) {
    errors.push(
      "NEXO_DDEX_RECIPIENT_DPID is not configured. Generation requires an explicit recipient (no invented DSP DPIDs)."
    );
  }
  if (cfg.testRecipient && !cfg.recipientPartyId) {
    errors.push("Test recipient flag is set but no recipient DPID is configured.");
  }
  return errors;
}

export function isDdexGenerationConfigured(cfg: DdexRuntimeConfig = readDdexConfig()): boolean {
  return ddexConfigErrors(cfg).length === 0;
}

/** Public admin summary — never includes DPID values. */
export function ddexConfigPublicStatus(cfg: DdexRuntimeConfig = readDdexConfig()) {
  return {
    senderConfigured: Boolean(cfg.senderPartyId),
    senderName: cfg.senderName,
    recipientConfigured: Boolean(cfg.recipientPartyId),
    recipientName: cfg.recipientName,
    recipientConfigKey: cfg.recipientConfigKey,
    testRecipient: cfg.testRecipient,
    messageControlType: cfg.messageControlType,
    ernVersion: cfg.ernVersion,
    ernNamespace: cfg.ernNamespace,
    avsVersionId: cfg.avsVersionId,
    releaseProfileVersionId: cfg.releaseProfileVersionId,
  };
}
