export type PublishingRegistrationStatus =
  | "draft"
  | "pending"
  | "submitted"
  | "registered"
  | "conflict"
  | "unavailable";

export type PublishingRightType =
  | "performance"
  | "mechanical"
  | "sync"
  | "print"
  | "international";

export type PublishingPartyKind = "writer" | "publisher" | "admin" | "other";

export type PublishingWork = {
  id: string;
  title: string;
  iswc: string | null;
  registration_status: PublishingRegistrationStatus;
  territories: string[];
  conflict_reason: string | null;
};

export const PUBLISHING_RIGHT_TYPES: PublishingRightType[] = [
  "performance",
  "mechanical",
  "sync",
  "print",
  "international",
];

export const NO_FAKE_COLLECTION_MESSAGE =
  "Publishing collections UNAVAILABLE — PRO/CMO sources are not connected. No collected royalty figures are shown.";

export const NO_FAKE_REGISTRATION_MESSAGE =
  "PRO registration is not claimed without a connected registration source.";
