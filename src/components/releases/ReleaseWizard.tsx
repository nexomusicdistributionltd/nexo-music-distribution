"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  createReleaseDraft,
  getDistributionMetadataLookups,
  getDistributionPreferenceDefaults,
  prepareAssetUpload,
  registerUploadedAsset,
  replaceContributors,
  replaceTracks,
  submitRelease,
  updateReleaseInfo,
} from "@/app/(portal)/dashboard/releases/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { DeliveryBrandIcon } from "@/components/releases/DeliveryBrandIcon";
import { createClient } from "@/lib/supabase/client";
import { CONTRIBUTOR_ROLE_OPTIONS } from "@/lib/releases/contributor-roles";
import type {
  ContributorRole,
  ReleaseAssetRow,
  ReleaseContributorRow,
  ReleaseRow,
  ReleaseTrackRow,
  ReleaseType,
} from "@/lib/releases/types";
import { assertArtworkFile, assertAudioFile } from "@/lib/storage/release-assets";

const STEPS = [
  "Type",
  "Info",
  "Tracks",
  "Contributors",
  "Artwork",
  "Rights",
  "Distribution",
  "Review",
] as const;

const ADDITIONAL_DELIVERY_OPTIONS = [
  { key: "youtube", label: "YouTube Content ID" },
  { key: "facebook", label: "Meta Rights Manager" },
  { key: "soundcloud", label: "SoundCloud Monetization" },
  { key: "soundExchange", label: "SoundExchange" },
  { key: "beatPort", label: "Beatport" },
  { key: "trackLibs", label: "Tracklib" },
  { key: "hook", label: "Hook" },
  { key: "lyricfind", label: "LyricFind" },
] as const;

type UploadState = {
  kind: "audio" | "artwork";
  trackIndex?: number;
  filename: string;
  percent: number;
  status: "uploading" | "processing" | "success" | "error";
};

function ensureRightsPrefix(value: string | null | undefined, symbol: "©" | "℗") {
  const body = (value ?? "").replace(/^[©℗]\s*/, "").trim();
  return `${symbol} ${body}`;
}

function wizardLicenseType(value: unknown): "Copyright" | "Creative Commons" {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, " ") : "";
  return ["creative commons", "creative-commons", "cc"].includes(normalized)
    ? "Creative Commons"
    : "Copyright";
}

function parseTimestamp(value: string) {
  const raw = value.trim();
  if (!raw) return 0;
  if (/^\d+(\.\d+)?$/.test(raw)) return Math.max(0, Number(raw));
  const parts = raw.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return 0;
}

function formatTimestamp(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

type TrackDraft = {
  id?: string;
  track_number: number;
  title: string;
  version: string;
  isrc: string;
  iswc: string;
  liner_note: string;
  tiktok_start_time: string;
  explicit: boolean;
  clean_version: boolean;
  instrumental: boolean;
  ai_assisted: boolean;
  language: string;
  lyrics: string;
};

type ContribDraft = {
  name: string;
  role: ContributorRole;
  share_percent: string;
  track_id: string;
  ipi_cae: string;
  isni: string;
};

export type RosterOption = { id: string; artist_name: string; stage_name: string };

export function ReleaseWizard({
  initial,
  tracks: initialTracks,
  contributors: initialContributors,
  assets: initialAssets,
  mode = "create",
  accountRole = "artist",
  rosterArtists = [],
  initialArtistProfileId = "",
  defaultLabelName = "",
}: {
  initial?: ReleaseRow | null;
  tracks?: ReleaseTrackRow[];
  contributors?: ReleaseContributorRow[];
  assets?: ReleaseAssetRow[];
  mode?: "create" | "edit";
  accountRole?: "artist" | "label";
  rosterArtists?: RosterOption[];
  initialArtistProfileId?: string;
  defaultLabelName?: string;
}) {
  const router = useRouter();
  const initialDistribution =
    initial?.distribution_settings && typeof initial.distribution_settings === "object"
      ? initial.distribution_settings
      : {};
  const seededRosterArtistId = initial?.artist_profile_id ?? initialArtistProfileId;
  const seededRosterArtist = rosterArtists.find((artist) => artist.id === seededRosterArtistId);
  const initialAdditional =
    initialDistribution.additional &&
    typeof initialDistribution.additional === "object" &&
    !Array.isArray(initialDistribution.additional)
      ? (initialDistribution.additional as Record<string, unknown>)
      : {};

  const [step, setStep] = React.useState(0);
  const [releaseId, setReleaseId] = React.useState<string | null>(initial?.id ?? null);
  const [type, setType] = React.useState<ReleaseType>(initial?.release_type ?? "single");
  const [rosterArtistId, setRosterArtistId] = React.useState<string>(
    seededRosterArtistId ?? ""
  );
  const [info, setInfo] = React.useState({
    title: initial?.title ?? "",
    version: initial?.version ?? "",
    primary_artist_name:
      initial?.primary_artist_name ??
      (accountRole === "label"
        ? seededRosterArtist?.artist_name || seededRosterArtist?.stage_name || ""
        : ""),
    genre: initial?.genre ?? "",
    subgenre: initial?.subgenre ?? "",
    language: initial?.language ?? "en",
    release_date: initial?.release_date ?? "",
    original_release_date: initial?.original_release_date ?? "",
    label_name: initial?.label_name ?? (accountRole === "label" ? defaultLabelName : ""),
    description: initial?.description ?? "",
    explicit: initial?.explicit ?? false,
  });
  const [rights, setRights] = React.useState({
    copyright_year: initial?.copyright_year?.toString() ?? String(new Date().getFullYear()),
    copyright_line: ensureRightsPrefix(initial?.copyright_line, "©"),
    phonogram_line: ensureRightsPrefix(initial?.phonogram_line, "℗"),
    upc: initial?.upc ?? "",
  });
  const [territories, setTerritories] = React.useState(
    (initial?.territories ?? ["WW"]).join(", ")
  );
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<string[]>(
    Array.isArray(initialDistribution.platforms)
      ? initialDistribution.platforms.filter((value): value is string => typeof value === "string")
      : []
  );
  const initialApplePreorderDate =
    typeof initialDistribution.applePreorderDate === "string"
      ? initialDistribution.applePreorderDate.trim()
      : "";
  const [providerMeta, setProviderMeta] = React.useState({
    applePreorder:
      initialDistribution.applePreorder === true && Boolean(initialApplePreorderDate),
    applePreorderDate: initialApplePreorderDate,
    licenseType: wizardLicenseType(initialDistribution.licenseType),
    licenseInfo:
      typeof initialDistribution.licenseInfo === "string"
        ? initialDistribution.licenseInfo
        : "",
    reviewNote:
      typeof initialDistribution.reviewNote === "string"
        ? initialDistribution.reviewNote
        : "",
    releaseTime:
      typeof initialDistribution.releaseTime === "string"
        ? initialDistribution.releaseTime
        : "",
    timeZone:
      typeof initialDistribution.timeZone === "string"
        ? initialDistribution.timeZone
        : "",
    isAiGenerated: initialDistribution.isAiGenerated === true,
    providerArtistId:
      typeof initialDistribution.providerArtistId === "string" ||
      typeof initialDistribution.providerArtistId === "number"
        ? String(initialDistribution.providerArtistId)
        : "",
    youtubeRightsConfirmed:
      initialDistribution.additionalRightsConfirmed === true ||
      initialDistribution.confirmYoutubeRights === true,
    additional: {
      youtube: initialAdditional.youtube === true,
      facebook: initialAdditional.facebook === true,
      soundcloud: initialAdditional.soundcloud === true,
      soundExchange: initialAdditional.soundExchange === true,
      beatPort: initialAdditional.beatPort === true,
      junoDownloads: false,
      trackLibs: initialAdditional.trackLibs === true,
      hook: initialAdditional.hook === true,
      lyricfind: initialAdditional.lyricfind === true,
      // EVEN is account-linked upstream; keep it off until Nexo has a documented connection check.
      even: false,
    },
    coverSongs: Array.isArray(initialDistribution.coverSongs)
      ? initialDistribution.coverSongs
          .filter((value): value is string => typeof value === "string")
          .join(", ")
      : "",
  });
  const [tracks, setTracks] = React.useState<TrackDraft[]>(
    initialTracks?.length
      ? initialTracks.map((t) => ({
          id: t.id,
          track_number: t.track_number,
          title: t.title,
          version: t.version ?? "",
          isrc: t.isrc ?? "",
          iswc: t.iswc ?? "",
          liner_note: t.liner_note ?? "",
          tiktok_start_time: t.tiktok_start_time ?? "",
          explicit: t.explicit,
          clean_version: t.clean_version ?? false,
          instrumental: t.instrumental ?? false,
          ai_assisted: t.ai_assisted ?? false,
          language: t.language ?? initial?.language ?? "en",
          lyrics: t.lyrics ?? "",
        }))
      : [{
          track_number: 1,
          title: "",
          version: "",
          isrc: "",
          iswc: "",
          liner_note: "",
          tiktok_start_time: "",
          explicit: false,
          clean_version: false,
          instrumental: false,
          ai_assisted: false,
          language: initial?.language ?? "en",
          lyrics: "",
        }]
  );
  const [contributors, setContributors] = React.useState<ContribDraft[]>(
    initialContributors?.length
      ? initialContributors.map((c) => ({
          name: c.name,
          role: c.role,
          share_percent: c.share_percent?.toString() ?? "",
          track_id: c.track_id ?? "",
          ipi_cae: (c as ReleaseContributorRow).ipi_cae ?? "",
          isni: (c as ReleaseContributorRow).isni ?? "",
        }))
      : [{
          name:
            initial?.primary_artist_name ??
            (accountRole === "label"
              ? seededRosterArtist?.artist_name || seededRosterArtist?.stage_name || ""
              : ""),
          role: "primary_artist",
          share_percent: "",
          track_id: "",
          ipi_cae: "",
          isni: "",
        }]
  );
  const [assets, setAssets] = React.useState(initialAssets ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [uploadState, setUploadState] = React.useState<UploadState | null>(null);
  const [audioPreviewUrls, setAudioPreviewUrls] = React.useState<Record<string, string>>({});
  const [audioDurations, setAudioDurations] = React.useState<Record<string, number>>({});
  const [artworkPreviewUrl, setArtworkPreviewUrl] = React.useState<string | null>(null);
  const [providerGenres, setProviderGenres] = React.useState<Array<{ value: string; label: string }>>([]);
  const [providerLanguages, setProviderLanguages] = React.useState<Array<{ value: string; label: string }>>([]);
  const [providerPlatforms, setProviderPlatforms] = React.useState<Array<{ value: string; label: string }>>([]);
  const [providerCountries, setProviderCountries] = React.useState<Array<{ value: string; label: string }>>([]);
  const [providerPreferenceArtists, setProviderPreferenceArtists] = React.useState<
    Array<{ value: string; label: string }>
  >([]);
  const [providerPreferencesBusy, setProviderPreferencesBusy] = React.useState(false);
  const [submissionSuccess, setSubmissionSuccess] = React.useState<{
    id: string;
    title: string;
  } | null>(null);

  const timeZones = React.useMemo(() => {
    const intlApi = Intl as typeof Intl & {
      supportedValuesOf?: (key: "timeZone") => string[];
    };
    const values = intlApi.supportedValuesOf?.("timeZone") ?? [
      "UTC",
      "Africa/Lagos",
      "Africa/Accra",
      "Africa/Johannesburg",
      "Europe/London",
      "Europe/Paris",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Asia/Dubai",
      "Asia/Kolkata",
      "Asia/Tokyo",
      "Australia/Sydney",
    ];
    return ["", ...values];
  }, []);

  const copyrightYears = React.useMemo(() => {
    const current = new Date().getFullYear() + 1;
    return Array.from({ length: current - 1899 }, (_, index) => String(current - index));
  }, []);

  const selectedTerritoryCodes = React.useMemo(
    () =>
      territories
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [territories]
  );
  const worldwideTerritories = selectedTerritoryCodes.includes("WW");

  const compositionCreditsReady = tracks.length > 0 && tracks.every((track) =>
    contributors.some((contributor) =>
      contributor.name.trim() &&
      (!contributor.track_id || contributor.track_id === track.id) &&
      ["composer", "songwriter"].includes(contributor.role)
    )
  );
  const contributorCount = contributors.filter((contributor) => contributor.name.trim()).length;

  React.useEffect(() => {
    let active = true;
    void getDistributionMetadataLookups().then((result) => {
      if (!active || !result.ok) return;
      setProviderGenres(result.data.genres);
      setProviderLanguages(result.data.languages);
      setProviderPlatforms(result.data.platforms);
      setProviderCountries(result.data.countries);
      setProviderPreferenceArtists(result.data.preferenceArtists);
    });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    const loadPreviews = async () => {
      if (!assets.length) return;
      const supabase = createClient();
      const artworkAsset = assets.find((asset) => asset.kind === "artwork");
      if (artworkAsset) {
        const { data } = await supabase.storage
          .from(artworkAsset.storage_bucket)
          .createSignedUrl(artworkAsset.storage_path, 3600);
        if (active && data?.signedUrl) setArtworkPreviewUrl(data.signedUrl);
      }

      const previews: Record<string, string> = {};
      for (const asset of assets.filter((item) => item.kind === "audio")) {
        const { data } = await supabase.storage
          .from(asset.storage_bucket)
          .createSignedUrl(asset.storage_path, 3600);
        if (data?.signedUrl) {
          previews[asset.track_id ?? "__single__"] = data.signedUrl;
        }
      }
      if (active && Object.keys(previews).length) {
        setAudioPreviewUrls((current) => ({ ...current, ...previews }));
      }
    };
    void loadPreviews();
    return () => {
      active = false;
    };
  }, [assets]);

  async function uploadToStorageWithProgress(options: {
    bucket: string;
    path: string;
    file: File;
    contentType: string;
    onProgress: (percent: number) => void;
  }) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!session?.access_token || !baseUrl || !anonKey) {
      throw new Error("Secure upload session is unavailable. Sign in again and retry.");
    }

    const encodedPath = options.path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const endpoint = `${baseUrl.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(
      options.bucket
    )}/${encodedPath}`;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint, true);
      xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      xhr.setRequestHeader("apikey", anonKey);
      xhr.setRequestHeader("Content-Type", options.contentType);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        options.onProgress(Math.min(95, Math.round((event.loaded / event.total) * 95)));
      };
      xhr.onerror = () => reject(new Error("Network error while uploading the file."));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          let message = "Upload failed.";
          try {
            const payload = JSON.parse(xhr.responseText) as { message?: string; error?: string };
            message = payload.message || payload.error || message;
          } catch {
            // Keep generic message.
          }
          reject(new Error(message));
        }
      };
      xhr.send(options.file);
    });
  }

  async function applyDistributionPreferences() {
    setError(null);
    setProviderPreferencesBusy(true);
    try {
      const result = await getDistributionPreferenceDefaults(
        providerMeta.providerArtistId || null
      );
      if (!result.ok) throw new Error(result.error);
      const defaults = result.data;

      setInfo((current) => ({
        ...current,
        primary_artist_name: current.primary_artist_name || defaults.artistName || "",
        genre: current.genre || defaults.primaryGenre || "",
        subgenre: current.subgenre || defaults.secondaryGenre || "",
        language:
          !initial?.language && current.language === "en"
            ? defaults.language || current.language
            : current.language || defaults.language || "en",
        label_name: current.label_name || defaults.label || "",
      }));
      setRights((current) => ({
        ...current,
        copyright_line: current.copyright_line.replace(/^©\s*/, "").trim()
          ? current.copyright_line
          : ensureRightsPrefix(defaults.cLine, "©"),
        phonogram_line: current.phonogram_line.replace(/^℗\s*/, "").trim()
          ? current.phonogram_line
          : ensureRightsPrefix(defaults.pLine, "℗"),
      }));
      setProviderMeta((current) => {
        const hasAdditionalSelection = Object.values(current.additional).some(Boolean);
        return {
          ...current,
          releaseTime: current.releaseTime || defaults.releaseTime || "",
          timeZone: current.timeZone || defaults.timeZone || "",
          additional: hasAdditionalSelection
            ? current.additional
            : { ...current.additional, ...defaults.additional, junoDownloads: false },
        };
      });
      setSelectedPlatforms((current) =>
        current.length > 0 || defaults.stores.length === 0 ? current : defaults.stores
      );
      setTerritories((current) =>
        current && current !== "WW"
          ? current
          : defaults.territories.length
            ? defaults.territories.join(", ")
            : current
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load distribution preferences.");
    } finally {
      setProviderPreferencesBusy(false);
    }
  }

  async function ensureDraft(): Promise<string> {
    if (releaseId) return releaseId;
    if (accountRole === "label" && !rosterArtistId) {
      throw new Error("Select a roster artist before creating the release.");
    }
    setBusy(true);
    try {
      const res = await createReleaseDraft({
        release_type: type,
        artist_profile_id: accountRole === "label" ? rosterArtistId : undefined,
      });
      if (!res.ok) throw new Error(res.error);
      setReleaseId(res.data.id);
      return res.data.id;
    } finally {
      setBusy(false);
    }
  }

  async function saveInfo(id: string) {
    const res = await updateReleaseInfo(id, {
      release_type: type,
      title: info.title,
      version: info.version || null,
      primary_artist_name: info.primary_artist_name,
      genre: info.genre || null,
      subgenre: info.subgenre || null,
      language: info.language || null,
      release_date: info.release_date || null,
      original_release_date: info.original_release_date || null,
      label_name: info.label_name || null,
      description: info.description || null,
      explicit: info.explicit,
      copyright_year: rights.copyright_year ? Number(rights.copyright_year) : null,
      copyright_line: rights.copyright_line || null,
      phonogram_line: rights.phonogram_line || null,
      upc: rights.upc || null,
      territories: territories
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      distribution_settings: {
        ...initialDistribution,
        worldwide: territories.toUpperCase().includes("WW"),
        platforms: selectedPlatforms,
        providerArtistId: providerMeta.providerArtistId || null,
        additional: providerMeta.additional,
        confirmYoutubeRights:
          providerMeta.additional.youtube && providerMeta.youtubeRightsConfirmed,
        additionalRightsConfirmed: providerMeta.youtubeRightsConfirmed,
        applePreorder:
          providerMeta.applePreorder && Boolean(providerMeta.applePreorderDate),
        applePreorderDate:
          providerMeta.applePreorder && providerMeta.applePreorderDate
            ? providerMeta.applePreorderDate
            : null,
        licenseType:
          providerMeta.licenseType === "Copyright"
            ? null
            : providerMeta.licenseType || null,
        licenseInfo:
          providerMeta.licenseType === "Creative Commons"
            ? providerMeta.licenseInfo || null
            : null,
        reviewNote: providerMeta.reviewNote || null,
        releaseTime: providerMeta.releaseTime || null,
        timeZone: providerMeta.timeZone || null,
        isAiGenerated: providerMeta.isAiGenerated,
        coverSongs: providerMeta.coverSongs
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      },
    });
    if (!res.ok) throw new Error(res.error);
  }

  async function saveTracks(id: string) {
    const res = await replaceTracks(
      id,
      tracks.map((t, i) => ({
        id: t.id,
        track_number: i + 1,
        title: t.title,
        version: t.version || null,
        isrc: t.isrc || null,
        iswc: t.iswc || null,
        liner_note: t.liner_note || null,
        tiktok_start_time: t.tiktok_start_time || null,
        explicit: t.explicit,
        clean_version: t.clean_version,
        instrumental: t.instrumental,
        ai_assisted: t.ai_assisted,
        language: t.language || info.language || null,
        lyrics: t.lyrics.trim() || null,
      }))
    );
    if (!res.ok) throw new Error(res.error);
    if (res.data.tracks?.length) {
      setTracks(
        res.data.tracks.map((t) => ({
          id: t.id,
          track_number: t.track_number,
          title: t.title,
          version: t.version ?? "",
          isrc: t.isrc ?? "",
          iswc: t.iswc ?? "",
          liner_note: t.liner_note ?? "",
          tiktok_start_time: t.tiktok_start_time ?? "",
          explicit: t.explicit,
          clean_version: t.clean_version ?? false,
          instrumental: t.instrumental ?? false,
          ai_assisted: t.ai_assisted ?? false,
          language: t.language ?? info.language ?? "en",
          lyrics: t.lyrics ?? "",
        }))
      );
    }
    return res.data.tracks ?? [];
  }

  async function saveContributors(id: string) {
    // share_percent is optional ownership metadata only — NOT DDEX DisplayArtist %
    const res = await replaceContributors(
      id,
      contributors
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name,
          role: c.role,
          track_id: c.track_id || null,
          share_percent: c.share_percent ? Number(c.share_percent) : null,
          ipi_cae: c.ipi_cae || null,
          isni: c.isni || null,
        }))
    );
    if (!res.ok) throw new Error(res.error);
  }

  async function next() {
    setError(null);
    setBusy(true);
    try {
      if (step === 0) {
        const alreadyPersisted = Boolean(releaseId);
        const id = await ensureDraft();
        // New drafts are created with the selected release type already. Avoid
        // a second Server Action/network roundtrip on the very first Continue.
        if (alreadyPersisted) {
          await updateReleaseInfo(id, { release_type: type });
        }
      } else if (step === 1) {
        const id = await ensureDraft();
        await saveInfo(id);
      } else if (step === 2) {
        const id = await ensureDraft();
        await saveTracks(id);
      } else if (step === 3) {
        const id = await ensureDraft();
        await saveContributors(id);
      } else if (step === 5 || step === 6) {
        const id = await ensureDraft();
        await saveInfo(id);
      }
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save step");
    } finally {
      setBusy(false);
    }
  }

  async function artworkDimensions(file: File): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  async function onUpload(kind: "audio" | "artwork", file: File, trackIndex?: number) {
    setError(null);
    const check = kind === "audio" ? assertAudioFile(file) : assertArtworkFile(file);
    if (check) {
      setError(check);
      return;
    }

    let clientArtworkMeta: { width: number; height: number } | null = null;
    if (kind === "artwork") {
      try {
        clientArtworkMeta = await artworkDimensions(file);
      } catch {
        const lower = file.name.toLowerCase();
        const isTiff =
          file.type === "image/tiff" || lower.endsWith(".tif") || lower.endsWith(".tiff");
        if (!isTiff) {
          setError("Could not read the artwork dimensions. Use a valid JPG, PNG, or TIFF file.");
          return;
        }
      }
      if (clientArtworkMeta) {
        const { width, height } = clientArtworkMeta;
        const accepted = width === height && width >= 3000 && width <= 5000;
        if (!accepted) {
          setError(
            `Artwork is ${width}×${height}px. Nexo requires square artwork between 3000×3000 and 5000×5000px.`
          );
          return;
        }
      }
    }

    const id = await ensureDraft();
    setUploadState({
      kind,
      trackIndex,
      filename: file.name,
      percent: 0,
      status: "uploading",
    });

    try {
      let resolvedTrackId: string | null = null;
      if (kind === "audio") {
        if (trackIndex == null) throw new Error("Track selection is required for audio upload.");
        const persistedTracks = await saveTracks(id);
        resolvedTrackId = persistedTracks[trackIndex]?.id ?? null;
        if (!resolvedTrackId) {
          throw new Error("Nexo could not save the track before audio upload. Retry the upload.");
        }
      }

      const prep = await prepareAssetUpload({ releaseId: id, kind, filename: file.name });
      if (!prep.ok) throw new Error(prep.error);
      const uploadMimeType =
        kind === "audio"
          ? "audio/flac"
          : file.type || (file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

      await uploadToStorageWithProgress({
        bucket: prep.data.bucket,
        path: prep.data.path,
        file,
        contentType: uploadMimeType,
        onProgress: (percent) =>
          setUploadState((current) =>
            current
              ? { ...current, percent, status: "uploading" }
              : current
          ),
      });

      setUploadState((current) =>
        current ? { ...current, percent: 97, status: "processing" } : current
      );

      const replaceAsset =
        kind === "audio" && resolvedTrackId
          ? assets.find(
              (asset) => asset.kind === "audio" && asset.track_id === resolvedTrackId
            )
          : kind === "artwork"
            ? assets.find((asset) => asset.kind === "artwork")
            : undefined;

      const reg = await registerUploadedAsset({
        releaseId: id,
        trackId: resolvedTrackId,
        kind,
        storagePath: prep.data.path,
        filename: file.name,
        mimeType: uploadMimeType,
        sizeBytes: file.size,
        width: clientArtworkMeta?.width ?? null,
        height: clientArtworkMeta?.height ?? null,
        replaceAssetId: replaceAsset?.id ?? null,
      });
      if (!reg.ok) throw new Error(reg.error);

      const nextAsset: ReleaseAssetRow = {
        id: reg.data.id,
        release_id: id,
        track_id: resolvedTrackId,
        kind,
        storage_bucket: prep.data.bucket,
        storage_path: prep.data.path,
        filename: file.name,
        mime_type: uploadMimeType,
        size_bytes: file.size,
        checksum: null,
        width: clientArtworkMeta?.width ?? null,
        height: clientArtworkMeta?.height ?? null,
        codec: kind === "audio" ? "flac" : null,
        container: kind === "audio" ? "flac" : null,
        sample_rate_hz: null,
        bit_depth: null,
        channels: null,
        duration_ms: null,
        hash_algorithm: null,
        uploaded_by: null,
        created_at: new Date().toISOString(),
      };

      setAssets((current) => [
        ...current.filter((asset) => {
          if (kind === "artwork") return asset.kind !== "artwork";
          return !(
            asset.kind === "audio" &&
            resolvedTrackId &&
            asset.track_id === resolvedTrackId
          );
        }),
        nextAsset,
      ]);

      const supabase = createClient();
      const { data: signed } = await supabase.storage
        .from(prep.data.bucket)
        .createSignedUrl(prep.data.path, 3600);
      if (signed?.signedUrl) {
        if (kind === "artwork") {
          setArtworkPreviewUrl(signed.signedUrl);
        } else if (resolvedTrackId) {
          setAudioPreviewUrls((current) => ({
            ...current,
            [resolvedTrackId]: signed.signedUrl,
          }));
        }
      }

      setUploadState((current) =>
        current ? { ...current, percent: 100, status: "success" } : current
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      setError(message);
      setUploadState((current) =>
        current ? { ...current, status: "error" } : current
      );
    }
  }

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      if (providerMeta.applePreorder && !providerMeta.applePreorderDate) {
        throw new Error(
          "Apple Music pre-order is enabled but no pre-order date is set. Add a date in Distribution → Apple Music pre-order, or turn pre-order off."
        );
      }
      if (
        providerMeta.licenseType === "Creative Commons" &&
        !providerMeta.licenseInfo.trim()
      ) {
        throw new Error(
          "Creative Commons requires a license clause. Add the CC 3.0 clause in Distribution → License information, or choose Copyright."
        );
      }
      const usesExclusiveRightsDelivery =
        providerMeta.additional.youtube ||
        providerMeta.additional.facebook ||
        providerMeta.additional.soundcloud;
      if (usesExclusiveRightsDelivery && !providerMeta.youtubeRightsConfirmed) {
        throw new Error(
          "Confirm that you control 100% of the exclusive rights required for the selected rights-management deliveries before submitting."
        );
      }
      const id = await ensureDraft();
      await saveInfo(id);
      await saveTracks(id);
      await saveContributors(id);
      const res = await submitRelease(id);
      if (!res.ok) throw new Error(res.error);
      setSubmissionSuccess({
        id,
        title: info.title.trim() || res.data.title || "Your release",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const artwork = assets.find((a) => a.kind === "artwork");
  const audioAssets = assets.filter((a) => a.kind === "audio");

  return (
    <div className="space-y-6">
      {submissionSuccess ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="release-submit-success-title"
            className="w-full max-w-lg rounded-[2rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-7 text-center shadow-2xl"
          >
            <div className="text-5xl" aria-hidden="true">🎊🎉🎈</div>
            <h2 id="release-submit-success-title" className="mt-4 text-2xl font-semibold">
              Congratulations!
            </h2>
            <p className="mt-3 text-base text-[var(--nexo-text-secondary)]">
              <strong>{submissionSuccess.title}</strong> has been submitted for distribution.
            </p>
            <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
              Nexo will now review the release and keep you updated on its distribution status.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                onClick={() => router.push(`/dashboard/releases/${submissionSuccess.id}`)}
              >
                View submitted release
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/releases")}
              >
                Back to releases
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <section className="rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 shadow-[var(--nexo-shadow-sm)] sm:p-6">
        <div className="flex items-center justify-between gap-4"><div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">Release builder</p><p className="mt-1 text-small text-[var(--nexo-text-secondary)]">Complete the release metadata, audio, contributors, rights and delivery settings before QC submission.</p></div><span className="shrink-0 text-caption font-semibold">{step + 1} / {STEPS.length}</span></div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--nexo-elevated)]"><div className="h-full rounded-full bg-[var(--nexo-text)] transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      </section>
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 text-caption ${
              i === step
                ? "bg-[var(--nexo-primary)] text-[var(--nexo-primary-fg)]"
                : i < step
                  ? "bg-[var(--nexo-elevated)] text-[var(--nexo-text)]"
                  : "text-[var(--nexo-text-muted)]"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error ? (
        <Alert variant="error" title="Could not continue">
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(["single", "ep", "album", "compilation"] as ReleaseType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-[var(--nexo-radius-lg)] border p-4 text-left ${
                    type === t
                      ? "border-[var(--nexo-text)] bg-[var(--nexo-elevated)]"
                      : "border-[var(--nexo-border)]"
                  }`}
                >
                  <p className="font-medium capitalize">{t}</p>
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                    {t === "single"
                      ? "1–3 tracks"
                      : t === "ep"
                        ? "2–6 tracks"
                        : t === "album"
                          ? "7+ tracks"
                          : "Multi-artist compilation"}
                  </p>
                </button>
              ))}
              {accountRole === "label" ? (
                <div className="sm:col-span-3 space-y-2">
                  <label className="block space-y-1">
                    <span className="text-caption text-[var(--nexo-text-muted)]">Roster artist *</span>
                    <Select
                      value={rosterArtistId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setRosterArtistId(id);
                        const a = rosterArtists.find((r) => r.id === id);
                        if (a) {
                          const artistName = a.artist_name || a.stage_name;
                          setInfo((prev) => ({
                            ...prev,
                            primary_artist_name: artistName,
                          }));
                          setContributors((prev) =>
                            prev.map((contributor, index) =>
                              index === 0 && contributor.role === "primary_artist"
                                ? { ...contributor, name: artistName }
                                : contributor
                            )
                          );
                        }
                      }}
                      disabled={Boolean(releaseId)}
                    >
                      <option value="">Select roster artist…</option>
                      {rosterArtists.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.artist_name || a.stage_name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  {rosterArtists.length === 0 ? (
                    <p className="text-small text-[var(--nexo-text-muted)]">
                      No roster artists yet.{" "}
                      <Link href="/app/artists/new" className="underline">Create an artist</Link> first.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="sm:col-span-3 text-small text-[var(--nexo-text-muted)]">
                  Artist account: your artist profile is linked automatically.
                </p>
              )}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-caption text-[var(--nexo-text-muted)]">Title</span>
                <Input value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Version / subtitle</span>
                <Input value={info.version} onChange={(e) => setInfo({ ...info, version: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Primary artist</span>
                <Input
                  value={info.primary_artist_name}
                  onChange={(e) => setInfo({ ...info, primary_artist_name: e.target.value })}
                  readOnly={accountRole === "label"}
                />
              </label>
              {providerPreferenceArtists.length > 0 ? (
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-caption text-[var(--nexo-text-muted)]">
                    Artist delivery profile
                  </span>
                  <Select
                    value={providerMeta.providerArtistId}
                    onChange={(e) =>
                      setProviderMeta((current) => ({
                        ...current,
                        providerArtistId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Match by artist name</option>
                    {providerPreferenceArtists.map((artist) => (
                      <option key={artist.value} value={artist.value}>
                        {artist.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    Uses the artist profile already linked to your Nexo distribution account.
                  </p>
                </label>
              ) : null}
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-small font-medium">Release defaults</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    Apply saved genre, language, label/copyright lines, delivery platforms, territories,
                    release time and eligible additional-delivery defaults.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    providerPreferencesBusy ||
                    (accountRole === "label" && !providerMeta.providerArtistId)
                  }
                  onClick={() => void applyDistributionPreferences()}
                >
                  {providerPreferencesBusy ? "Loading…" : "Apply saved preferences"}
                </Button>
              </div>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Primary genre</span>
                <Select
                  value={info.genre}
                  onChange={(e) => setInfo({ ...info, genre: e.target.value })}
                >
                  <option value="">Select primary genre…</option>
                  {info.genre && !providerGenres.some((genre) => genre.value === info.genre) ? (
                    <option value={info.genre}>{info.genre}</option>
                  ) : null}
                  {providerGenres.map((genre) => (
                    <option key={genre.value} value={genre.value}>{genre.label}</option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Secondary genre</span>
                <Select
                  value={info.subgenre}
                  onChange={(e) => setInfo({ ...info, subgenre: e.target.value })}
                >
                  <option value="">Select secondary genre…</option>
                  {info.subgenre && !providerGenres.some((genre) => genre.value === info.subgenre) ? (
                    <option value={info.subgenre}>{info.subgenre}</option>
                  ) : null}
                  {providerGenres.map((genre) => (
                    <option key={genre.value} value={genre.value}>{genre.label}</option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Language</span>
                <Input
                  list="nexo-provider-languages"
                  value={info.language}
                  onChange={(e) => setInfo({ ...info, language: e.target.value })}
                />
                <datalist id="nexo-provider-languages">
                  {providerLanguages.map((language) => (
                    <option key={language.value} value={language.value}>{language.label}</option>
                  ))}
                </datalist>
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Release date</span>
                <Input
                  type="date"
                  value={info.release_date}
                  onChange={(e) => setInfo({ ...info, release_date: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Original release date</span>
                <Input
                  type="date"
                  value={info.original_release_date}
                  onChange={(e) => setInfo({ ...info, original_release_date: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Label name</span>
                <Input
                  value={info.label_name}
                  onChange={(e) => setInfo({ ...info, label_name: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={info.explicit}
                  onChange={(e) => setInfo({ ...info, explicit: e.target.checked })}
                />
                <span className="text-small">Explicit content</span>
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-caption text-[var(--nexo-text-muted)]">Description</span>
                <Textarea
                  value={info.description}
                  onChange={(e) => setInfo({ ...info, description: e.target.value })}
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-small text-[var(--nexo-text-muted)]">
                Enter complete DSP metadata for every track. ISRC is never fabricated. This API delivery flow requires a lossless FLAC master for every track.
              </p>
              {tracks.map((t, idx) => (
                <div key={idx} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-small font-medium">Track {idx + 1}</p>
                    {tracks.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTracks(tracks.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    placeholder="Title"
                    value={t.title}
                    onChange={(e) => {
                      const next = [...tracks];
                      next[idx] = { ...t, title: e.target.value };
                      setTracks(next);
                    }}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-caption text-[var(--nexo-text-muted)]">Version / subtitle</span>
                      <Input
                        placeholder="Optional version"
                        value={t.version}
                        onChange={(e) => {
                          const next = [...tracks];
                          next[idx] = { ...t, version: e.target.value };
                          setTracks(next);
                        }}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-caption font-medium text-[var(--nexo-text)]">ISRC (optional)</span>
                      <Input
                        placeholder="e.g. USRC17607839"
                        value={t.isrc}
                        onChange={(e) => {
                          const next = [...tracks];
                          next[idx] = { ...t, isrc: e.target.value.toUpperCase() };
                          setTracks(next);
                        }}
                      />
                      <span className="text-caption text-[var(--nexo-text-muted)]">
                        Leave blank if you do not already have an ISRC.
                      </span>
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="ISWC (optional)"
                      value={t.iswc}
                      onChange={(e) => {
                        const next = [...tracks];
                        next[idx] = { ...t, iswc: e.target.value.toUpperCase() };
                        setTracks(next);
                      }}
                    />
                    <Input
                      placeholder="TikTok start time (optional)"
                      value={t.tiktok_start_time}
                      onChange={(e) => {
                        const next = [...tracks];
                        next[idx] = { ...t, tiktok_start_time: e.target.value };
                        setTracks(next);
                      }}
                    />
                  </div>
                  <label className="block space-y-1">
                    <span className="text-caption text-[var(--nexo-text-muted)]">Liner note</span>
                    <Textarea
                      rows={3}
                      value={t.liner_note}
                      placeholder="Optional track notes"
                      onChange={(e) => {
                        const next = [...tracks];
                        next[idx] = { ...t, liner_note: e.target.value };
                        setTracks(next);
                      }}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-caption text-[var(--nexo-text-muted)]">Track language</span>
                      <Input
                        value={t.language}
                        placeholder="en"
                        onChange={(e) => {
                          const next = [...tracks];
                          next[idx] = { ...t, language: e.target.value };
                          setTracks(next);
                        }}
                      />
                    </label>
                    <div className="grid gap-2 pt-6">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={t.explicit}
                          onChange={(e) => {
                            const next = [...tracks];
                            next[idx] = {
                              ...t,
                              explicit: e.target.checked,
                              clean_version: e.target.checked ? false : t.clean_version,
                            };
                            setTracks(next);
                          }}
                        />
                        <span className="text-small">Explicit lyrics/content</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={t.clean_version}
                          onChange={(e) => {
                            const next = [...tracks];
                            next[idx] = {
                              ...t,
                              clean_version: e.target.checked,
                              explicit: e.target.checked ? false : t.explicit,
                            };
                            setTracks(next);
                          }}
                        />
                        <span className="text-small">Clean version</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={t.instrumental}
                          onChange={(e) => {
                            const next = [...tracks];
                            next[idx] = {
                              ...t,
                              instrumental: e.target.checked,
                              lyrics: e.target.checked ? "" : t.lyrics,
                            };
                            setTracks(next);
                          }}
                        />
                        <span className="text-small">Instrumental</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={t.ai_assisted}
                          onChange={(e) => {
                            const next = [...tracks];
                            next[idx] = { ...t, ai_assisted: e.target.checked };
                            setTracks(next);
                          }}
                        />
                        <span className="text-small">AI-assisted audio/content</span>
                      </label>
                    </div>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-caption text-[var(--nexo-text-muted)]">Lyrics</span>
                    <Textarea
                      rows={8}
                      value={t.lyrics}
                      placeholder="Paste the complete lyrics for this track. Leave blank only for instrumentals."
                      onChange={(e) => {
                        const next = [...tracks];
                        next[idx] = { ...t, lyrics: e.target.value };
                        setTracks(next);
                      }}
                    />
                  </label>
                  <div className="space-y-3">
                    <label className="text-caption text-[var(--nexo-text-muted)]">Lossless FLAC master</label>
                    <Input
                      type="file"
                      accept=".flac,audio/flac,audio/x-flac,application/flac,application/octet-stream"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void onUpload("audio", file, idx);
                      }}
                    />

                    {uploadState?.kind === "audio" && uploadState.trackIndex === idx ? (
                      <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-4">
                        <div className="flex items-center justify-between gap-3 text-small">
                          <span className="truncate font-medium">
                            {uploadState.status === "success"
                              ? "Upload successful"
                              : uploadState.status === "processing"
                                ? "Verifying FLAC…"
                                : uploadState.status === "error"
                                  ? "Upload failed"
                                  : `Uploading ${uploadState.filename}`}
                          </span>
                          <span className="shrink-0 font-semibold">{uploadState.percent}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--nexo-bg)]">
                          <div
                            className="h-full rounded-full bg-[var(--nexo-primary)] transition-[width] duration-200"
                            style={{ width: `${uploadState.percent}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {(t.id && audioPreviewUrls[t.id]) ||
                    (tracks.length === 1 && audioPreviewUrls.__single__) ? (
                      <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-small font-medium">Track preview</span>
                          <span className="text-caption text-[var(--nexo-text-muted)]">FLAC uploaded</span>
                        </div>
                        <audio
                          className="w-full"
                          controls
                          preload="metadata"
                          src={
                            (t.id && audioPreviewUrls[t.id]) ||
                            audioPreviewUrls.__single__
                          }
                          onLoadedMetadata={(e) => {
                            const duration = e.currentTarget.duration;
                            if (!Number.isFinite(duration)) return;
                            setAudioDurations((current) => ({
                              ...current,
                              [t.id ?? `track-${idx}`]: duration,
                            }));
                          }}
                        />
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-caption text-[var(--nexo-text-muted)]">
                              TikTok start time
                            </span>
                            <span className="text-caption font-medium">
                              {t.tiktok_start_time || "0:00"}
                            </span>
                          </div>
                          <input
                            className="w-full"
                            type="range"
                            min={0}
                            max={Math.max(
                              1,
                              Math.floor(
                                audioDurations[t.id ?? `track-${idx}`] ?? 60
                              )
                            )}
                            step={1}
                            value={Math.min(
                              parseTimestamp(t.tiktok_start_time),
                              Math.max(
                                1,
                                Math.floor(
                                  audioDurations[t.id ?? `track-${idx}`] ?? 60
                                )
                              )
                            )}
                            onChange={(e) => {
                              const next = [...tracks];
                              next[idx] = {
                                ...t,
                                tiktok_start_time: formatTimestamp(Number(e.target.value)),
                              };
                              setTracks(next);
                            }}
                          />
                          <p className="text-caption text-[var(--nexo-text-muted)]">
                            Choose where the song should begin when used on TikTok.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {audioAssets.some(
                      (asset) =>
                        asset.kind === "audio" &&
                        (asset.track_id === t.id ||
                          (tracks.length === 1 && asset.track_id == null))
                    ) ? (
                      <p className="text-caption text-[var(--nexo-text-muted)]">
                        Audio is linked to this track. Upload another FLAC to replace it.
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setTracks([
                    ...tracks,
                    {
                      track_number: tracks.length + 1,
                      title: "",
                      version: "",
                      isrc: "",
                      iswc: "",
                      liner_note: "",
                      tiktok_start_time: "",
                      explicit: false,
                      clean_version: false,
                      instrumental: false,
                      ai_assisted: false,
                      language: info.language || "en",
                      lyrics: "",
                    },
                  ])
                }
              >
                Add track
              </Button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <p className="text-small text-[var(--nexo-text-muted)]">
                Add accurate track credits. Available categories include primary/featured artist,
                lead vocals, background vocals, choir/chorus, guitar, bass, drums, keyboard/piano,
                percussion, instrumentalist/background musician, songwriter, composer, lyricist,
                arranger, producer, recording/mixing/mastering engineers, graphic designer,
                publisher, A&amp;R, artist manager and more.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-3">
                  <p className="text-small font-medium">Primary artist</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {info.primary_artist_name.trim() ? "Set for this release" : "Required"}
                  </p>
                </div>
                <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-3">
                  <p className="text-small font-medium">Songwriter / composer</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {compositionCreditsReady ? "All tracks credited" : "Add one for every track"}
                  </p>
                </div>
                <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-3">
                  <p className="text-small font-medium">Credits added</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {contributorCount} contributor{contributorCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              {contributors.map((c, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Input
                    placeholder="Name"
                    value={c.name}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, name: e.target.value };
                      setContributors(next);
                    }}
                  />
                  <Select
                    value={c.role}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, role: e.target.value as ContributorRole };
                      setContributors(next);
                    }}
                  >
                    {CONTRIBUTOR_ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={c.track_id}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, track_id: e.target.value };
                      setContributors(next);
                    }}
                  >
                    <option value="">Entire release</option>
                    {tracks.map((t, ti) => (
                      <option key={t.id ?? `t${ti}`} value={t.id ?? ""} disabled={!t.id}>
                        Track {ti + 1}{t.title ? `: ${t.title}` : ""}{!t.id ? " (save tracks first)" : ""}
                      </option>
                    ))}
                  </Select>
                  <Input
                    placeholder="Share % (optional metadata)"
                    value={c.share_percent}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, share_percent: e.target.value };
                      setContributors(next);
                    }}
                  />
                  <Input
                    placeholder="IPI/CAE (optional)"
                    value={c.ipi_cae}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, ipi_cae: e.target.value };
                      setContributors(next);
                    }}
                  />
                  <Input
                    placeholder="ISNI (optional)"
                    value={c.isni}
                    onChange={(e) => {
                      const next = [...contributors];
                      next[idx] = { ...c, isni: e.target.value };
                      setContributors(next);
                    }}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setContributors([
                    ...contributors,
                    { name: "", role: "other", share_percent: "", track_id: "", ipi_cae: "", isni: "" },
                  ])
                }
              >
                Add contributor
              </Button>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-3">
              <div className="space-y-1 text-small text-[var(--nexo-text-muted)]">
                <p>Cover artwork must meet Nexo delivery requirements:</p>
                <p className="font-medium text-[var(--nexo-text)]">Square · 3000–5000 px · JPG, PNG, or TIFF · max 36 MB</p>
                <p>Use RGB artwork. Nexo verifies file type, size, and dimensions before the release can pass QC.</p>
              </div>
              <Input
                type="file"
                accept=".jpg,.jpeg,.png,.tif,.tiff,image/jpeg,image/png,image/tiff,application/octet-stream"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUpload("artwork", file);
                }}
              />

              {uploadState?.kind === "artwork" ? (
                <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-4">
                  <div className="flex items-center justify-between gap-3 text-small">
                    <span className="truncate font-medium">
                      {uploadState.status === "success"
                        ? "Artwork upload successful"
                        : uploadState.status === "processing"
                          ? "Verifying artwork…"
                          : uploadState.status === "error"
                            ? "Artwork upload failed"
                            : `Uploading ${uploadState.filename}`}
                    </span>
                    <span className="shrink-0 font-semibold">{uploadState.percent}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--nexo-bg)]">
                    <div
                      className="h-full rounded-full bg-[var(--nexo-primary)] transition-[width] duration-200"
                      style={{ width: `${uploadState.percent}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {artwork && artworkPreviewUrl ? (
                <div className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
                  <img
                    src={artworkPreviewUrl}
                    alt="Uploaded release artwork preview"
                    className="aspect-square w-full max-w-sm object-cover"
                  />
                  <div className="border-t border-[var(--nexo-border)] p-3">
                    <p className="text-small font-medium">Upload successful</p>
                    <p className="text-caption text-[var(--nexo-text-muted)]">{artwork.filename}</p>
                  </div>
                </div>
              ) : artwork ? (
                <p className="text-small">
                  Current: <span className="font-medium">{artwork.filename}</span>
                </p>
              ) : (
                <p className="text-small text-[var(--nexo-text-muted)]">No artwork uploaded yet.</p>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={providerMeta.isAiGenerated}
                  onChange={(e) =>
                    setProviderMeta((current) => ({ ...current, isAiGenerated: e.target.checked }))
                  }
                />
                <span className="text-small">
                  This cover artwork was generated with AI
                </span>
              </label>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Copyright year</span>
                <Select
                  value={rights.copyright_year}
                  onChange={(e) => setRights({ ...rights, copyright_year: e.target.value })}
                >
                  {copyrightYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">UPC (optional — Nexo can assign one if omitted)</span>
                <Input
                  value={rights.upc}
                  onChange={(e) => setRights({ ...rights, upc: e.target.value })}
                  placeholder="12–14 digits if you have one"
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-caption text-[var(--nexo-text-muted)]">Copyright line (C)</span>
                <div className="flex items-center rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-bg)]">
                  <span className="pl-3 text-small font-semibold" aria-hidden="true">©</span>
                  <Input
                    className="border-0 shadow-none focus:ring-0"
                    value={rights.copyright_line.replace(/^©\s*/, "")}
                    onChange={(e) =>
                      setRights({
                        ...rights,
                        copyright_line: ensureRightsPrefix(e.target.value, "©"),
                      })
                    }
                    placeholder="2026 Artist or copyright owner"
                  />
                </div>
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-caption text-[var(--nexo-text-muted)]">Phonogram line (P)</span>
                <div className="flex items-center rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-bg)]">
                  <span className="pl-3 text-small font-semibold" aria-hidden="true">℗</span>
                  <Input
                    className="border-0 shadow-none focus:ring-0"
                    value={rights.phonogram_line.replace(/^℗\s*/, "")}
                    onChange={(e) =>
                      setRights({
                        ...rights,
                        phonogram_line: ensureRightsPrefix(e.target.value, "℗"),
                      })
                    }
                    placeholder="2026 Artist, label or master owner"
                  />
                </div>
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">License type</span>
                <Select
                  value={providerMeta.licenseType}
                  onChange={(e) => {
                    const licenseType =
                      e.target.value === "Creative Commons" ? "Creative Commons" : "Copyright";
                    setProviderMeta((current) => ({ ...current, licenseType }));
                  }}
                >
                  <option value="Copyright">Copyright</option>
                  <option value="Creative Commons">Creative Commons</option>
                </Select>
              </label>
              <label className="block space-y-1">
                <span className="text-caption text-[var(--nexo-text-muted)]">Cover song titles (comma-separated)</span>
                <Input
                  value={providerMeta.coverSongs}
                  onChange={(e) =>
                    setProviderMeta((current) => ({ ...current, coverSongs: e.target.value }))
                  }
                  placeholder="Leave blank when not applicable"
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-caption text-[var(--nexo-text-muted)]">License / clearance information</span>
                <Textarea
                  value={providerMeta.licenseInfo}
                  onChange={(e) =>
                    setProviderMeta((current) => ({ ...current, licenseInfo: e.target.value }))
                  }
                  placeholder="Ownership, cover-license or clearance notes when applicable"
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-caption text-[var(--nexo-text-muted)]">Content review note</span>
                <Textarea
                  value={providerMeta.reviewNote}
                  onChange={(e) =>
                    setProviderMeta((current) => ({ ...current, reviewNote: e.target.value }))
                  }
                  placeholder="Beat licenses, sample clearances, label waivers, capitalization requests, or anything QC should know"
                />
              </label>
            </div>
          ) : null}

          {step === 6 ? (
            <div className="space-y-5">
              <Alert title="Distribution">
                Nexo manages delivery after your release passes quality control. Platform, country, genre and language choices below use Nexo&apos;s live distribution configuration.
              </Alert>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-caption text-[var(--nexo-text-muted)]">Release time</span>
                  <Input
                    type="time"
                    value={providerMeta.releaseTime}
                    onChange={(e) =>
                      setProviderMeta((current) => ({ ...current, releaseTime: e.target.value }))
                    }
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-caption text-[var(--nexo-text-muted)]">Time zone</span>
                  <Select
                    value={providerMeta.timeZone}
                    onChange={(e) =>
                      setProviderMeta((current) => ({ ...current, timeZone: e.target.value }))
                    }
                  >
                    <option value="">Store default / local midnight</option>
                    {timeZones.filter(Boolean).map((zone) => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </Select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={providerMeta.applePreorder}
                    onChange={(e) =>
                      setProviderMeta((current) => ({ ...current, applePreorder: e.target.checked }))
                    }
                  />
                  <span className="text-small">Apple Music pre-order</span>
                </label>
                {providerMeta.applePreorder ? (
                  <label className="block space-y-1">
                    <span className="text-caption text-[var(--nexo-text-muted)]">Pre-order date</span>
                    <Input
                      type="date"
                      value={providerMeta.applePreorderDate}
                      onChange={(e) =>
                        setProviderMeta((current) => ({
                          ...current,
                          applePreorderDate: e.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
              </div>

              <fieldset className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
                <legend className="px-1 text-caption font-medium text-[var(--nexo-text-muted)]">
                  Territories
                </legend>
                <Select
                  value={worldwideTerritories ? "worldwide" : "custom"}
                  onChange={(e) =>
                    setTerritories(e.target.value === "worldwide" ? "WW" : "")
                  }
                >
                  <option value="worldwide">Worldwide — all available territories</option>
                  <option value="custom">Select specific countries / territories</option>
                </Select>

                {!worldwideTerritories ? (
                  <details className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                    <summary className="cursor-pointer text-small font-medium">
                      {selectedTerritoryCodes.length
                        ? `${selectedTerritoryCodes.length} selected`
                        : "Choose countries / territories"}
                    </summary>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-caption text-[var(--nexo-text-muted)]">
                        Live territory list
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setTerritories(providerCountries.map((country) => country.value).join(", "))
                        }
                      >
                        Select all
                      </Button>
                    </div>
                    <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                      {providerCountries.map((country) => (
                        <label key={country.value} className="flex items-center gap-2 text-small">
                          <input
                            type="checkbox"
                            checked={selectedTerritoryCodes.includes(country.value)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...new Set([...selectedTerritoryCodes, country.value])]
                                : selectedTerritoryCodes.filter((code) => code !== country.value);
                              setTerritories(next.join(", "));
                            }}
                          />
                          <span>{country.label}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                ) : null}
              </fieldset>

              <fieldset className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
                <legend className="px-1 text-caption font-medium text-[var(--nexo-text-muted)]">
                  Additional deliveries
                </legend>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  Choose any optional additional-delivery services you want Nexo to request.
                  Enable only services for which you control the required rights.
                </p>
                <label className="flex items-center gap-2 text-small font-medium">
                  <input
                    type="checkbox"
                    checked={ADDITIONAL_DELIVERY_OPTIONS.every(
                      (option) => providerMeta.additional[option.key]
                    )}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setProviderMeta((current) => ({
                        ...current,
                        additional: {
                          ...current.additional,
                          ...Object.fromEntries(
                            ADDITIONAL_DELIVERY_OPTIONS.map((option) => [option.key, enabled])
                          ),
                          junoDownloads: false,
                        },
                      }));
                    }}
                  />
                  <span>Select all additional deliveries</span>
                </label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ADDITIONAL_DELIVERY_OPTIONS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-small">
                      <input
                        type="checkbox"
                        checked={Boolean(
                          providerMeta.additional[
                            key as keyof typeof providerMeta.additional
                          ]
                        )}
                        onChange={(e) =>
                          setProviderMeta((current) => ({
                            ...current,
                            additional: {
                              ...current.additional,
                              [key]: e.target.checked,
                            },
                          }))
                        }
                      />
                      <DeliveryBrandIcon name={label} className="h-5 w-5 shrink-0" />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                {providerMeta.additional.youtube ||
                providerMeta.additional.facebook ||
                providerMeta.additional.soundcloud ? (
                  <label className="flex items-start gap-2 rounded-[var(--nexo-radius)] bg-[var(--nexo-elevated)] p-3">
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={providerMeta.youtubeRightsConfirmed}
                      onChange={(e) =>
                        setProviderMeta((current) => ({
                          ...current,
                          youtubeRightsConfirmed: e.target.checked,
                        }))
                      }
                    />
                    <span className="text-small">
                      I confirm I control 100% of the exclusive rights required for the selected
                      content-identification / monetization services.
                    </span>
                  </label>
                ) : null}
              </fieldset>

              {providerPlatforms.length > 0 ? (
                <fieldset className="space-y-2">
                  <legend className="text-caption text-[var(--nexo-text-muted)]">
                    Delivery platforms
                  </legend>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    Choose individual destinations or select every currently available Nexo delivery platform.
                  </p>
                  <label className="flex items-center gap-2 text-small font-medium">
                    <input
                      type="checkbox"
                      checked={
                        providerPlatforms.length > 0 &&
                        providerPlatforms.every((platform) =>
                          selectedPlatforms.includes(platform.value)
                        )
                      }
                      onChange={(e) =>
                        setSelectedPlatforms(
                          e.target.checked
                            ? providerPlatforms.map((platform) => platform.value)
                            : []
                        )
                      }
                    />
                    <span>Select all delivery platforms</span>
                  </label>
                  <div className="grid max-h-64 gap-2 overflow-y-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-3 sm:grid-cols-2 lg:grid-cols-3">
                    {providerPlatforms.map((platform) => (
                      <label key={platform.value} className="flex items-center gap-2 text-small">
                        <input
                          type="checkbox"
                          checked={selectedPlatforms.includes(platform.value)}
                          onChange={(e) =>
                            setSelectedPlatforms((current) =>
                              e.target.checked
                                ? [...new Set([...current, platform.value])]
                                : current.filter((value) => value !== platform.value)
                            )
                          }
                        />
                        <DeliveryBrandIcon name={platform.label} className="h-5 w-5 shrink-0" />
                        <span>{platform.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </div>
          ) : null}

          {step === 7 ? (
            <div className="space-y-6 text-small">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
                <div>
                  {artwork && artworkPreviewUrl ? (
                    <img
                      src={artworkPreviewUrl}
                      alt={`${info.title || "Release"} artwork`}
                      className="aspect-square w-full rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] object-cover shadow-[var(--nexo-shadow-sm)]"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-[var(--nexo-radius-xl)] border border-dashed border-[var(--nexo-border)] bg-[var(--nexo-elevated)] text-[var(--nexo-text-muted)]">
                      Artwork missing
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-caption uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">Release review</p>
                    <h3 className="mt-1 text-xl font-semibold">{info.title || "Untitled release"}</h3>
                    <p className="text-small text-[var(--nexo-text-muted)]">{info.primary_artist_name || "Artist not set"}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                      <p className="text-caption text-[var(--nexo-text-muted)]">Release date</p>
                      <p className="mt-1 font-medium">{info.release_date || "Not set"}</p>
                    </div>
                    <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                      <p className="text-caption text-[var(--nexo-text-muted)]">Release time</p>
                      <p className="mt-1 font-medium">
                        {providerMeta.releaseTime || "Store default"}
                        {providerMeta.timeZone ? ` · ${providerMeta.timeZone}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                    <p className="text-caption text-[var(--nexo-text-muted)]">Delivery platforms</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {(selectedPlatforms.length
                        ? selectedPlatforms
                        : providerPlatforms.map((platform) => platform.value)
                      ).map((value) => {
                        const platform = providerPlatforms.find((item) => item.value === value);
                        const label = platform?.label || value;
                        return (
                          <span
                            key={value}
                            title={label}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-elevated)]"
                          >
                            <DeliveryBrandIcon name={label} className="h-6 w-6" />
                            <span className="sr-only">{label}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {ADDITIONAL_DELIVERY_OPTIONS.some(
                    (option) => providerMeta.additional[option.key]
                  ) ? (
                    <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                      <p className="text-caption text-[var(--nexo-text-muted)]">Additional deliveries</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {ADDITIONAL_DELIVERY_OPTIONS
                          .filter((option) => providerMeta.additional[option.key])
                          .map((option) => (
                            <span
                              key={option.key}
                              title={option.label}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-elevated)]"
                            >
                              <DeliveryBrandIcon name={option.label} className="h-6 w-6" />
                              <span className="sr-only">{option.label}</span>
                            </span>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">Songs</h4>
                {tracks.map((track, index) => {
                  const preview =
                    (track.id && audioPreviewUrls[track.id]) ||
                    (tracks.length === 1 ? audioPreviewUrls.__single__ : undefined);
                  return (
                    <div
                      key={track.id ?? index}
                      className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {index + 1}. {track.title || `Track ${index + 1}`}
                          </p>
                          <p className="text-caption text-[var(--nexo-text-muted)]">
                            ISRC: {track.isrc || "Not provided"}
                          </p>
                        </div>
                        <span className="text-caption text-[var(--nexo-text-muted)]">
                          TikTok {track.tiktok_start_time || "0:00"}
                        </span>
                      </div>
                      {preview ? (
                        <audio className="mt-3 w-full" controls preload="metadata" src={preview} />
                      ) : (
                        <p className="mt-3 text-caption text-[var(--nexo-text-muted)]">
                          Audio preview unavailable.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <p><strong>Type:</strong> {type}</p>
                <p><strong>UPC:</strong> {rights.upc || "Not provided"}</p>
                <p><strong>Territories:</strong> {worldwideTerritories ? "Worldwide" : selectedTerritoryCodes.join(", ") || "None"}</p>
                <p><strong>Contributors:</strong> {contributors.filter((item) => item.name.trim()).length}</p>
              </div>

              <Alert title="Submit to QC">
                Submitting locks this release for review before delivery.
              </Alert>
            </div>
          ) : null}

          {step === STEPS.length - 1 && error ? (
            <Alert variant="error" title="Could not submit to QC">
              {error}
            </Alert>
          ) : null}

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => void next()} disabled={busy}>
                {busy ? "Saving…" : "Continue"}
              </Button>
            ) : (
              <Button onClick={() => void onSubmit()} disabled={busy}>
                {busy ? "Submitting…" : mode === "edit" ? "Save & submit to QC" : "Submit to QC"}
              </Button>
            )}
          </div>
          {releaseId ? (
            <p className="text-caption text-[var(--nexo-text-muted)]">
              Draft ID: {releaseId} — you can leave and resume from catalog.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
