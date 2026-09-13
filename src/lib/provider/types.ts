import "server-only";

/** Provider-independent distribution adapter (Batch 4). Server-only. */

export { ProviderNotConnectedError } from "./errors";

export type ProviderReleasePayload = {
  releaseId: string;
  title: string;
  type: "single" | "ep" | "album";
  primaryArtistName: string;
  upc?: string | null;
  releaseDate?: string | null;
  tracks: Array<{
    trackNumber: number;
    title: string;
    isrc?: string | null;
    audioStoragePath?: string | null;
  }>;
  artworkStoragePath?: string | null;
  territories?: string[];
  metadata?: Record<string, unknown>;
};

export type ProviderStatusResult = {
  providerReleaseId: string;
  status: string;
  message?: string;
  updatedAt: string;
};

export type ProviderDeliveryStatus = {
  providerReleaseId: string;
  deliveryStatus: string;
  dspStatuses?: Array<{ dsp: string; status: string }>;
  updatedAt: string;
};

export type ProviderCatalogQuery = {
  cursor?: string;
  limit?: number;
};

export type ProviderWebhookEvent = {
  type: string;
  payload: Record<string, unknown>;
  receivedAt: string;
};

/**
 * Concrete adapters implement this. Until a real provider is wired,
 * getDistributionProvider() returns NotConnectedProvider.
 */
export interface DistributionProvider {
  readonly name: string;
  readonly connected: boolean;

  submitRelease(input: ProviderReleasePayload): Promise<{ providerReleaseId: string }>;
  updateRelease(
    providerReleaseId: string,
    input: Partial<ProviderReleasePayload>
  ): Promise<void>;
  requestTakedown(providerReleaseId: string, reason?: string): Promise<void>;
  getReleaseStatus(providerReleaseId: string): Promise<ProviderStatusResult>;
  getDeliveryStatus(providerReleaseId: string): Promise<ProviderDeliveryStatus>;
  getCatalog(
    query: ProviderCatalogQuery
  ): Promise<{ items: unknown[]; nextCursor?: string }>;
  syncRelease(providerReleaseId: string): Promise<ProviderStatusResult>;
  handleWebhook(event: ProviderWebhookEvent): Promise<void>;
}
