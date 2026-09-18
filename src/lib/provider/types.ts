import "server-only";

/** Provider-independent distribution adapter. Server-only. */

export {
  ProviderNotConnectedError,
  ProviderUnavailableError,
  ProviderWebhookRejectedError,
} from "./errors";

export type ProviderReleasePayload = {
  releaseId: string;
  title: string;
  version?: string | null;
  remixTitle?: string | null;
  type: "single" | "ep" | "album" | "compilation";
  primaryArtistName: string;
  primaryArtistProviderId?: number | null;
  participants?: Array<{ name: string; role: string[]; artistId?: number }>;
  labelName?: string | null;
  genre?: string | null;
  subgenre?: string | null;
  language?: string | null;
  upc?: string | null;
  releaseDate?: string | null;
  originalReleaseDate?: string | null;
  applePreorder?: boolean;
  applePreorderDate?: string | null;
  licenseType?: string | null;
  licenseInfo?: string | null;
  releaseTime?: string | null;
  timeZone?: string | null;
  isAiGenerated?: boolean;
  coverSongs?: string[];
  copyrightYear?: number | null;
  copyrightLine?: string | null;
  phonogramLine?: string | null;
  tracks: Array<{
    trackId?: string | null;
    trackNumber: number;
    title: string;
    version?: string | null;
    isrc?: string | null;
    iswc?: string | null;
    linerNote?: string | null;
    tiktokStartTime?: string | null;
    language?: string | null;
    explicit?: boolean;
    cleanVersion?: boolean;
    instrumental?: boolean;
    lyrics?: string | null;
    aiAssisted?: boolean;
    artists?: Array<{ name: string; role: string[]; artistId?: number }>;
    writers?: Array<{ name: string; role: string[] }>;
    credits?: Array<{ name: string; role: string[] }>;
    audioStorageBucket?: string | null;
    audioStoragePath?: string | null;
    audioFilename?: string | null;
    audioMimeType?: string | null;
  }>;
  artworkStorageBucket?: string | null;
  artworkStoragePath?: string | null;
  artworkFilename?: string | null;
  artworkMimeType?: string | null;
  territories?: string[];
  deliverySettings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type ProviderStatusResult = {
  providerReleaseId: string;
  status: string;
  message?: string;
  updatedAt: string;
};

export type ProviderDspDeliveryStatus = {
  dsp: string;
  status: string;
  message?: string;
  updatedAt?: string;
};

export type ProviderDeliveryStatus = {
  providerReleaseId: string;
  deliveryStatus: string;
  dspStatuses?: ProviderDspDeliveryStatus[];
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
  eventId?: string;
  signature?: string | null;
  rawBody?: string;
};

/**
 * Concrete adapters implement this. Until a real provider is wired,
 * getProvider() / getDistributionProvider() returns NotConnectedProvider.
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
  reinstateRelease(providerReleaseId: string, reason?: string): Promise<void>;
  getReleaseStatus(providerReleaseId: string): Promise<ProviderStatusResult>;
  getDeliveryStatus(providerReleaseId: string): Promise<ProviderDeliveryStatus>;
  getCatalog(
    query: ProviderCatalogQuery
  ): Promise<{ items: unknown[]; nextCursor?: string }>;
  syncRelease(providerReleaseId: string): Promise<ProviderStatusResult>;
  handleWebhook(event: ProviderWebhookEvent): Promise<void>;
}
