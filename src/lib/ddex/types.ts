import type { ContributorRole, ReleaseType } from "@/lib/releases/types";
import type { DdexMessageControlType } from "./config";

export type DdexDealInput = {
  id?: string;
  territories?: string[] | null;
  use_types?: string[] | null;
  commercial_model_types?: string[] | null;
  validity_start?: string | null;
  validity_end?: string | null;
  is_default?: boolean | null;
};

export type DdexTrackInput = {
  id: string;
  track_number: number;
  title: string;
  version?: string | null;
  isrc?: string | null;
  duration_ms?: number | null;
  explicit?: boolean | null;
  language?: string | null;
};

export type DdexContributorInput = {
  id?: string;
  track_id?: string | null;
  name: string;
  role: ContributorRole | string;
  share_percent?: number | null;
  ipi_cae?: string | null;
  isni?: string | null;
};

export type DdexAssetInput = {
  id: string;
  track_id?: string | null;
  kind: "audio" | "artwork" | "other" | string;
  filename: string;
  mime_type?: string | null;
  storage_path?: string | null;
  checksum?: string | null;
  hash_algorithm?: string | null;
  width?: number | null;
  height?: number | null;
  codec?: string | null;
  container?: string | null;
  sample_rate_hz?: number | null;
  bit_depth?: number | null;
  channels?: number | null;
  duration_ms?: number | null;
  size_bytes?: number | null;
};

export type DdexReleaseInput = {
  id: string;
  release_type: ReleaseType | string;
  title: string;
  version?: string | null;
  primary_artist_name: string;
  genre?: string | null;
  subgenre?: string | null;
  language?: string | null;
  release_date?: string | null;
  original_release_date?: string | null;
  label_name?: string | null;
  copyright_year?: number | null;
  copyright_line?: string | null;
  phonogram_line?: string | null;
  upc?: string | null;
  explicit?: boolean | null;
  territories?: string[] | null;
  artist_profile_id?: string | null;
  label_profile_id?: string | null;
};

export type DdexCatalogSnapshot = {
  release: DdexReleaseInput;
  tracks: DdexTrackInput[];
  contributors: DdexContributorInput[];
  assets: DdexAssetInput[];
  deals: DdexDealInput[];
  artistName?: string | null;
  labelName?: string | null;
};

export type ErnParty = {
  reference: string;
  name: string;
  isLegalName?: boolean;
  isni?: string | null;
  ipi?: string | null;
};

export type ErnDisplayArtist = {
  partyReference: string;
  role: "MainArtist" | "FeaturedArtist" | "Artist";
  sequence: number;
};

export type ErnContributor = {
  partyReference: string;
  role: string;
  sequence: number;
};

export type ErnSoundRecording = {
  resourceReference: string;
  technicalReference: string;
  title: string;
  subtitle?: string | null;
  isrc: string;
  durationIso: string;
  parentalWarning: string;
  displayArtistName: string;
  displayArtists: ErnDisplayArtist[];
  contributors: ErnContributor[];
  pLineText: string;
  pLineYear: number;
  languageAndScriptCode: string;
  fileUri: string;
  hashAlgorithm: string | null;
  hashValue: string | null;
  codec: string | null;
  container: string | null;
  channels: number | null;
  sampleRateHz: number | null;
  bitDepth: number | null;
};

export type ErnImage = {
  resourceReference: string;
  technicalReference: string;
  proprietaryId: string;
  title: string;
  parentalWarning: string;
  cLineText: string;
  cLineYear: number;
  fileUri: string;
  hashAlgorithm: string | null;
  hashValue: string | null;
  codec: string | null;
  width: number | null;
  height: number | null;
};

export type ErnTrackRelease = {
  releaseReference: string;
  resourceReference: string;
  proprietaryId: string;
  title: string;
  subtitle?: string | null;
  genreText: string;
  subgenre?: string | null;
};

export type ErnMessageModel = {
  languageAndScriptCode: string;
  header: {
    messageId: string;
    messageThreadId: string;
    messageFileName: string;
    createdAt: string;
    senderPartyId: string;
    senderName: string;
    recipientPartyId: string;
    recipientName: string;
    messageControlType: DdexMessageControlType;
  };
  parties: ErnParty[];
  soundRecordings: ErnSoundRecording[];
  image: ErnImage;
  mainRelease: {
    releaseReference: string;
    releaseType: "Single" | "EP" | "Album";
    icpn: string;
    title: string;
    subtitle?: string | null;
    displayArtistName: string;
    displayArtists: ErnDisplayArtist[];
    labelPartyReference: string;
    pLineText: string;
    pLineYear: number;
    cLineText: string;
    cLineYear: number;
    durationIso: string;
    genreText: string;
    subgenre?: string | null;
    releaseDate: string;
    originalReleaseDate?: string | null;
    parentalWarning: string;
    resourceGroup: Array<{ sequence: number; resourceReference: string }>;
    coverResourceReference: string;
  };
  trackReleases: ErnTrackRelease[];
  deal: {
    releaseReferences: string[];
    territories: string[];
    startDate: string;
    endDate?: string | null;
    commercialModelTypes: string[];
    useTypes: string[];
  };
};

export type DdexValidationResult = {
  ok: boolean;
  errors: string[];
};

export type DdexMessageRecord = {
  id: string;
  release_id: string;
  message_id: string;
  recipient_config_key: string;
  message_type: string;
  ern_version: string;
  validation_status: "pending" | "valid" | "invalid";
  delivery_status: "pending" | "failed" | "delivered";
  created_at: string;
  validated_at: string | null;
  delivered_at: string | null;
  xml_storage_path: string | null;
  filename: string | null;
  xml_sha256: string | null;
  error: string | null;
  retry_count: number;
};
