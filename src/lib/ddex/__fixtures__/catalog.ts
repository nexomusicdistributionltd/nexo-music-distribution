import type { DdexRuntimeConfig } from "../config";
import type { DdexCatalogSnapshot } from "../types";

export const TEST_DDEX_CONFIG: DdexRuntimeConfig = {
  ernVersion: "4.3.2",
  ernNamespace: "http://ddex.net/xml/ern/432",
  avsVersionId: 9,
  releaseProfileVersionId: "Audio",
  senderName: "NEXO MUSIC DISTRIBUTION LTD",
  senderDpidDisplay: "PA-DPIDA-2026021501-H",
  senderPartyId: "PADPIDA2026021501H",
  recipientConfigKey: "test",
  recipientName: "Nexo Test Recipient",
  recipientDpidDisplay: "PA-DPIDA-2026021501-H",
  recipientPartyId: "PADPIDA2026021501H",
  testRecipient: true,
  messageControlType: "TestMessage",
  proprietaryNamespace: "PADPIDA2026021501H",
};

const HASH_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HASH_C = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

function audio(id: string, trackId: string, filename: string) {
  return {
    id,
    track_id: trackId,
    kind: "audio" as const,
    filename,
    mime_type: "audio/wav",
    storage_path: `owner/${id}/${filename}`,
    checksum: HASH_A,
    hash_algorithm: "sha256",
    codec: "PCM",
    container: "WAV",
    sample_rate_hz: 44100,
    bit_depth: 16,
    channels: 2,
    duration_ms: 195000,
    width: null,
    height: null,
    size_bytes: 1000,
  };
}

function cover(id: string) {
  return {
    id,
    track_id: null,
    kind: "artwork" as const,
    filename: "cover.jpg",
    mime_type: "image/jpeg",
    storage_path: `owner/${id}/cover.jpg`,
    checksum: HASH_B,
    hash_algorithm: "sha256",
    codec: "JPEG",
    container: null,
    sample_rate_hz: null,
    bit_depth: null,
    channels: null,
    duration_ms: null,
    width: 3000,
    height: 3000,
    size_bytes: 2000,
  };
}

const baseDeal = {
  id: "deal-1",
  territories: ["WW"],
  use_types: ["OnDemandStream", "PermanentDownload"],
  commercial_model_types: ["SubscriptionModel", "PayAsYouGoModel"],
  validity_start: "2026-09-15",
  validity_end: null,
  is_default: true,
};

export function singleFixture(overrides?: Partial<DdexCatalogSnapshot>): DdexCatalogSnapshot {
  const snap: DdexCatalogSnapshot = {
    release: {
      id: "rel-single",
      release_type: "single",
      title: "Midnight Run",
      version: null,
      primary_artist_name: "Luna Wave",
      genre: "pop",
      subgenre: null,
      language: "en",
      release_date: "2026-09-15",
      original_release_date: "2026-09-15",
      label_name: "NEXO MUSIC DISTRIBUTION LTD",
      copyright_year: 2026,
      copyright_line: "(C) 2026 NEXO MUSIC DISTRIBUTION LTD",
      phonogram_line: "(P) 2026 NEXO MUSIC DISTRIBUTION LTD",
      upc: "123456789012",
      explicit: false,
      territories: ["WW"],
      artist_profile_id: "artist-1",
      label_profile_id: "label-1",
    },
    tracks: [
      {
        id: "trk-1",
        track_number: 1,
        title: "Midnight Run",
        version: null,
        isrc: "USRC17607839",
        duration_ms: 195000,
        explicit: false,
        language: "en",
      },
    ],
    contributors: [
      { id: "c1", track_id: null, name: "Luna Wave", role: "primary_artist", share_percent: 50 },
      { id: "c2", track_id: "trk-1", name: "DJ Koda", role: "featured_artist", share_percent: 10 },
      { id: "c3", track_id: "trk-1", name: "Sam Producer", role: "producer", share_percent: 5 },
    ],
    assets: [audio("a1", "trk-1", "track01.wav"), cover("art1")],
    deals: [{ ...baseDeal, territories: ["WW"] }],
    artistName: "Luna Wave",
    labelName: "NEXO MUSIC DISTRIBUTION LTD",
  };
  return { ...snap, ...overrides };
}

export function epFixture(): DdexCatalogSnapshot {
  const s = singleFixture();
  s.release = { ...s.release, id: "rel-ep", release_type: "ep", title: "Night EP" };
  s.tracks = [
    s.tracks[0],
    {
      id: "trk-2",
      track_number: 2,
      title: "Second Light",
      version: "Radio Edit",
      isrc: "USRC17607840",
      duration_ms: 180000,
      explicit: false,
      language: "en",
    },
    {
      id: "trk-3",
      track_number: 3,
      title: "Closer & Far",
      version: null,
      isrc: "USRC17607841",
      duration_ms: 210000,
      explicit: false,
      language: "en",
    },
  ];
  s.assets = [
    audio("a1", "trk-1", "track01.wav"),
    { ...audio("a2", "trk-2", "track02.wav"), checksum: HASH_C, duration_ms: 180000 },
    { ...audio("a3", "trk-3", "track03.wav"), checksum: HASH_A, duration_ms: 210000 },
    cover("art1"),
  ];
  return s;
}

export function albumFixture(): DdexCatalogSnapshot {
  const s = epFixture();
  s.release = { ...s.release, id: "rel-album", release_type: "album", title: "Night Album" };
  s.tracks = [
    ...s.tracks,
    {
      id: "trk-4",
      track_number: 4,
      title: "Dawn Chorus",
      version: null,
      isrc: "GBUM71505078",
      duration_ms: 240000,
      explicit: true,
      language: "en",
    },
  ];
  s.assets = [
    ...s.assets.filter((a) => a.kind === "audio"),
    { ...audio("a4", "trk-4", "track04.wav"), duration_ms: 240000 },
    cover("art1"),
  ];
  s.release.explicit = true;
  return s;
}

export function unicodeSpecialCharsFixture(): DdexCatalogSnapshot {
  const s = singleFixture();
  s.release = {
    ...s.release,
    id: "rel-unicode",
    title: `Café <Night> & "Stars" 'Mix'`,
    primary_artist_name: "Luna 波",
  };
  s.tracks = [
    {
      ...s.tracks[0],
      title: `Track <1> & ünicode — 日本語`,
    },
  ];
  s.contributors = [
    { id: "c1", track_id: null, name: "Luna 波", role: "primary_artist" },
    { id: "c2", track_id: "trk-1", name: "Åsa & Co", role: "composer" },
  ];
  s.artistName = "Luna 波";
  return s;
}
