/**
 * DDEX ERN 4.3.2 production constants.
 * Namespace and AVS are fixed for production output — never emit ern/431 or AvsVersionId=7.
 * NEXO_DPID must come from server env only (never NEXT_PUBLIC_* / frontend).
 */

export const ERN_VERSION = "4.3.2" as const;
export const ERN_NAMESPACE = "http://ddex.net/xml/ern/432" as const;
export const AVS_NAMESPACE = "http://ddex.net/xml/allowed-value-sets" as const;
export const AVS_VERSION_ID = 9 as const;
export const RELEASE_PROFILE_VERSION_ID = "Audio" as const;
export const DDEX_MESSAGE_TYPE_NEW_RELEASE = "NewReleaseMessage" as const;
export const NEXO_SENDER_NAME = "NEXO MUSIC DISTRIBUTION LTD" as const;

export const DEFAULT_USE_TYPES = ["OnDemandStream", "PermanentDownload"] as const;
export const DEFAULT_COMMERCIAL_MODEL_TYPES = [
  "SubscriptionModel",
  "PayAsYouGoModel",
] as const;

export function getNexoDpid(): string | null {
  const value = process.env.NEXO_DPID?.trim();
  return value || null;
}
