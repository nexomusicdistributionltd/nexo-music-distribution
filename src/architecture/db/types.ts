/**
 * Database schema / domain types foundation (Batch 1 stubs).
 * These describe intended entities only — no ORM models, no seed data, no fake rows.
 */

export type UUID = string;
export type ISODateTime = string;

export type UserRole =
  | "artist"
  | "label_admin"
  | "label_member"
  | "publishing_admin"
  | "publishing_member"
  | "support"
  | "admin"
  | "super_admin";

export interface User {
  id: UUID;
  email: string;
  displayName: string;
  roles: UserRole[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Artist {
  id: UUID;
  name: string;
  userId?: UUID;
  labelId?: UUID;
  createdAt: ISODateTime;
}

export interface Label {
  id: UUID;
  name: string;
  ownerUserId: UUID;
  createdAt: ISODateTime;
}

export interface ArtistProfile {
  id: UUID;
  artistId: UUID;
  bio?: string;
  website?: string;
  socialLinks?: Record<string, string>;
}

export type ReleaseType = "single" | "ep" | "album" | "compilation";
export type ReleaseLifecycleStatus =
  | "draft"
  | "pending_qc"
  | "approved"
  | "submitted"
  | "processing"
  | "live"
  | "rejected"
  | "taken_down";

export interface Release {
  id: UUID;
  title: string;
  type: ReleaseType;
  artistId: UUID;
  labelId?: UUID;
  upcId?: UUID;
  status: ReleaseLifecycleStatus;
  releaseDate?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Track {
  id: UUID;
  releaseId: UUID;
  title: string;
  trackNumber: number;
  durationMs?: number;
  isrcId?: UUID;
  audioAssetId?: UUID;
}

export interface AudioAsset {
  id: UUID;
  storageKey: string;
  mimeType: string;
  checksum?: string;
  createdAt: ISODateTime;
}

export interface ArtworkAsset {
  id: UUID;
  storageKey: string;
  mimeType: string;
  width?: number;
  height?: number;
  createdAt: ISODateTime;
}

export interface Contributor {
  id: UUID;
  name: string;
  role: string;
  trackId?: UUID;
  releaseId?: UUID;
}

export interface Songwriter {
  id: UUID;
  name: string;
  ipi?: string;
  pro?: string;
}

export interface Split {
  id: UUID;
  workId?: UUID;
  trackId?: UUID;
  partyId: UUID;
  partyType: "songwriter" | "publisher" | "artist" | "label";
  sharePercent: number;
}

export interface IsrcCode {
  id: UUID;
  code: string;
  trackId?: UUID;
  allocatedAt?: ISODateTime;
}

export interface Upc {
  id: UUID;
  code: string;
  releaseId?: UUID;
  allocatedAt?: ISODateTime;
}

export interface Territory {
  id: UUID;
  isoCode: string;
  name: string;
}

export interface DspDelivery {
  id: UUID;
  releaseId: UUID;
  dspCode: string;
  status: "queued" | "sent" | "accepted" | "rejected" | "live";
  updatedAt: ISODateTime;
}

export interface QcReview {
  id: UUID;
  releaseId: UUID;
  reviewerId?: UUID;
  status: "pending" | "passed" | "failed";
  notes?: string;
  createdAt: ISODateTime;
}

export interface Rejection {
  id: UUID;
  releaseId: UUID;
  reason: string;
  source: "qc" | "dsp" | "internal";
  createdAt: ISODateTime;
}

export interface Royalty {
  id: UUID;
  periodStart: string;
  periodEnd: string;
  currency: string;
  grossAmount: string;
  netAmount: string;
  artistId?: UUID;
  labelId?: UUID;
}

export interface RoyaltyTransaction {
  id: UUID;
  royaltyId: UUID;
  releaseId?: UUID;
  trackId?: UUID;
  dspCode?: string;
  amount: string;
  currency: string;
  occurredAt: ISODateTime;
}

export interface Payout {
  id: UUID;
  userId: UUID;
  amount: string;
  currency: string;
  status: "requested" | "processing" | "paid" | "failed";
  createdAt: ISODateTime;
}

export interface PublishingWork {
  id: UUID;
  title: string;
  iswc?: string;
  createdAt: ISODateTime;
}

export interface PublishingRight {
  id: UUID;
  workId: UUID;
  partyName: string;
  rightType: "performance" | "mechanical" | "sync" | "other";
  sharePercent: number;
}

export interface Notification {
  id: UUID;
  userId: UUID;
  channel: "in_app" | "email";
  title: string;
  body: string;
  readAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface SupportTicket {
  id: UUID;
  userId: UUID;
  subject: string;
  status: "open" | "pending" | "resolved" | "closed";
  createdAt: ISODateTime;
}

export interface AuditLog {
  id: UUID;
  actorUserId?: UUID;
  action: string;
  entityType: string;
  entityId?: UUID;
  metadata?: Record<string, unknown>;
  createdAt: ISODateTime;
}

/** Entity name registry for future migrations / ORM mapping. */
export const DB_ENTITIES = [
  "users",
  "artists",
  "labels",
  "artist_profiles",
  "releases",
  "tracks",
  "audio_assets",
  "artwork_assets",
  "contributors",
  "songwriters",
  "splits",
  "isrc_codes",
  "upcs",
  "territories",
  "dsp_deliveries",
  "qc_reviews",
  "rejections",
  "royalties",
  "royalty_transactions",
  "payouts",
  "publishing_works",
  "publishing_rights",
  "notifications",
  "support_tickets",
  "audit_logs",
] as const;

export type DbEntityName = (typeof DB_ENTITIES)[number];
