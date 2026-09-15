/**
 * DDEX ERN 4.3.2 production constants.
 * Namespace and AVS are fixed for production output — never emit ern/431 or AvsVersionId=7.
 * Sender DPID must come from server env only (never NEXT_PUBLIC_* / frontend).
 * Prefer NEXO_DDEX_DPID; NEXO_DPID remains a documented alias.
 */

import { LOCKED_NEXO_PARTY_NAME } from "./identity";

export const ERN_VERSION = "4.3.2" as const;
export const ERN_NAMESPACE = "http://ddex.net/xml/ern/432" as const;
export const AVS_NAMESPACE = "http://ddex.net/xml/allowed-value-sets" as const;
export const AVS_VERSION_ID = 9 as const;
export const RELEASE_PROFILE_VERSION_ID = "Audio" as const;
export const DDEX_MESSAGE_TYPE_NEW_RELEASE = "NewReleaseMessage" as const;
export const NEXO_SENDER_NAME = LOCKED_NEXO_PARTY_NAME;
export const TEST_TARGET_SLUG = "nexo-local-test" as const;

export const DEFAULT_USE_TYPES = ["OnDemandStream", "PermanentDownload"] as const;
export const DEFAULT_COMMERCIAL_MODEL_TYPES = [
  "SubscriptionModel",
  "PayAsYouGoModel",
] as const;

function trimEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  return (env[name] ?? "").trim();
}

/** Server-only sender DPID (display form). Never expose via NEXT_PUBLIC_*. */
export function getNexoDpid(env: NodeJS.ProcessEnv = process.env): string | null {
  return trimEnv("NEXO_DDEX_DPID", env) || trimEnv("NEXO_DPID", env) || null;
}

export function getNexoPartyName(_env: NodeJS.ProcessEnv = process.env): string {
  void _env;
  return LOCKED_NEXO_PARTY_NAME;
}

/**
 * Contact is optional and must not be invented.
 * Returns null unless NEXO_DDEX_CONTACT is actually set.
 */
export function getNexoDdexContact(env: NodeJS.ProcessEnv = process.env): string | null {
  return trimEnv("NEXO_DDEX_CONTACT", env) || null;
}
