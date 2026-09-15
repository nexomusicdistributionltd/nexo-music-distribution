/**
 * DDEX ERN 4.3.2 foundation constants.
 * Stored for future NewReleaseMessage generation — NO XML is produced in this layer.
 * NEXO_DPID must come from server env only (never NEXT_PUBLIC_* / frontend).
 */

export const ERN_VERSION = "4.3.2" as const;
export const ERN_NAMESPACE = "http://ddex.net/xml/ern/432" as const;
export const AVS_NAMESPACE = "http://ddex.net/xml/avs" as const;
export const AVS_VERSION_ID = 9 as const;
export const DDEX_MESSAGE_TYPE_NEW_RELEASE = "NewReleaseMessage" as const;

export function getNexoDpid(): string | null {
  const value = process.env.NEXO_DPID?.trim();
  return value || null;
}

export const DEFAULT_USE_TYPES = ["OnDemandStream", "PermanentDownload"] as const;
export const DEFAULT_COMMERCIAL_MODEL_TYPES = [
  "SubscriptionModel",
  "PayAsYouGoModel",
] as const;
