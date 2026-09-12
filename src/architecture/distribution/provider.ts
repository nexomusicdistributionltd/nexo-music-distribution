/**
 * Distribution Provider Adapter Interface
 * --------------------------------------
 * Batch 1: interface only. No implementation, no credentials, no network calls.
 * A future provider (e.g. DistroKid-style, FUGA, Believe, custom) can implement
 * this contract without rebuilding the application shell.
 */

export type ProviderArtistId = string;
export type ProviderReleaseId = string;
export type ProviderTrackId = string;
export type ProviderAssetId = string;

export interface CreateArtistInput {
  name: string;
  displayName?: string;
  country?: string;
  externalIds?: Record<string, string>;
}

export interface UpdateArtistInput {
  name?: string;
  displayName?: string;
  country?: string;
  externalIds?: Record<string, string>;
}

export interface CreateReleaseInput {
  title: string;
  artistIds: ProviderArtistId[];
  type: "single" | "ep" | "album" | "compilation";
  upc?: string;
  releaseDate?: string;
  labelName?: string;
  territories?: string[];
}

export interface UpdateReleaseInput {
  title?: string;
  releaseDate?: string;
  labelName?: string;
  territories?: string[];
  metadata?: Record<string, unknown>;
}

export interface UploadAudioInput {
  releaseId: ProviderReleaseId;
  trackId?: ProviderTrackId;
  filename: string;
  mimeType: string;
  /** Byte stream or storage pointer — concrete providers define transport */
  sourceRef: string;
}

export interface UploadArtworkInput {
  releaseId: ProviderReleaseId;
  filename: string;
  mimeType: string;
  sourceRef: string;
}

export interface SubmitReleaseInput {
  releaseId: ProviderReleaseId;
  targetDsps?: string[];
  scheduledAt?: string;
}

export interface ReleaseStatus {
  releaseId: ProviderReleaseId;
  status:
    | "draft"
    | "pending_qc"
    | "approved"
    | "submitted"
    | "processing"
    | "live"
    | "rejected"
    | "takedown_requested"
    | "taken_down";
  message?: string;
  updatedAt: string;
}

export interface CatalogQuery {
  artistId?: ProviderArtistId;
  cursor?: string;
  limit?: number;
}

export interface RoyaltyQuery {
  from?: string;
  to?: string;
  releaseId?: ProviderReleaseId;
  cursor?: string;
}

export interface AnalyticsQuery {
  from?: string;
  to?: string;
  releaseId?: ProviderReleaseId;
  metrics?: string[];
}

/**
 * Adapter contract for an external distribution engine.
 * Implementations live outside Batch 1 and must never be stubbed with fake data.
 */
export interface DistributionProviderAdapter {
  createArtist(input: CreateArtistInput): Promise<ProviderArtistId>;
  updateArtist(id: ProviderArtistId, input: UpdateArtistInput): Promise<void>;
  createRelease(input: CreateReleaseInput): Promise<ProviderReleaseId>;
  updateRelease(id: ProviderReleaseId, input: UpdateReleaseInput): Promise<void>;
  uploadAudio(input: UploadAudioInput): Promise<ProviderAssetId>;
  uploadArtwork(input: UploadArtworkInput): Promise<ProviderAssetId>;
  submitRelease(input: SubmitReleaseInput): Promise<void>;
  getRelease(id: ProviderReleaseId): Promise<unknown>;
  getReleaseStatus(id: ProviderReleaseId): Promise<ReleaseStatus>;
  getCatalog(query: CatalogQuery): Promise<{ items: unknown[]; nextCursor?: string }>;
  requestTakedown(id: ProviderReleaseId, reason?: string): Promise<void>;
  getRoyaltyData(query: RoyaltyQuery): Promise<{ items: unknown[]; nextCursor?: string }>;
  getAnalytics(query: AnalyticsQuery): Promise<unknown>;
}

/** Registry placeholder — wire a real adapter in a later batch. */
export type DistributionProviderRegistry = {
  getActive(): DistributionProviderAdapter | null;
};
