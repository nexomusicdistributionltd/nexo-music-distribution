import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getProvider, getProviderConnectionState } from "@/lib/provider";
import type { ProviderReleasePayload } from "@/lib/provider/types";
import {
  toProviderErrorPayload,
  PROVIDER_DELIVERY_VALIDATION_CODE,
  PROVIDER_NOT_CONNECTED_CODE,
} from "@/lib/provider/errors";
import { mapProviderStatusToRelease } from "./types";

export type DistActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; data?: T };

export async function queueApprovedRelease(
  releaseId: string,
  notes?: string
): Promise<DistActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("queue_approved_release", {
    p_release_id: releaseId,
    p_notes: notes ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

/**
 * Idempotent submit of a queued job. Never invents provider success.
 * When provider not connected → records failed/unavailable truthfully.
 */
type DistributionReleaseAsset = {
  kind: string;
  track_id: string | null;
  storage_bucket: string;
  storage_path: string;
  filename: string;
  mime_type: string;
};

type DistributionReleaseTrack = {
  id: string;
  track_number: number;
  title: string;
  version: string | null;
  isrc: string | null;
  iswc: string | null;
  liner_note: string | null;
  tiktok_start_time: string | null;
  language: string | null;
  explicit: boolean;
  clean_version: boolean;
  instrumental: boolean;
  ai_assisted: boolean;
  lyrics: string | null;
};

type DistributionReleaseContributor = {
  track_id: string | null;
  name: string;
  role: string;
};

type DistributionReleaseRecord = {
  id: string;
  title: string;
  version: string | null;
  release_type: "single" | "ep" | "album" | "compilation";
  primary_artist_name: string;
  label_name: string | null;
  genre: string | null;
  subgenre: string | null;
  language: string | null;
  upc: string | null;
  release_date: string | null;
  original_release_date: string | null;
  copyright_year: number | null;
  copyright_line: string | null;
  phonogram_line: string | null;
  territories: string[] | null;
  distribution_settings: Record<string, unknown> | null;
  release_tracks: DistributionReleaseTrack[];
  release_assets: DistributionReleaseAsset[];
  release_contributors: DistributionReleaseContributor[];
};

function providerPayloadFromRelease(release: DistributionReleaseRecord): ProviderReleasePayload {
  const isFlacAsset = (asset: DistributionReleaseAsset) => {
    const mime = asset.mime_type.toLowerCase();
    const filename = asset.filename.toLowerCase();
    return (
      mime === "audio/flac" ||
      mime === "audio/x-flac" ||
      mime === "application/flac" ||
      filename.endsWith(".flac")
    );
  };
  const audioAssets = (release.release_assets ?? []).filter(
    (asset) => asset.kind === "audio" && isFlacAsset(asset)
  );
  const artwork = (release.release_assets ?? []).find(
    (asset) => asset.kind === "artwork"
  );
  const tracks = [...(release.release_tracks ?? [])].sort(
    (left, right) => left.track_number - right.track_number
  );

  const settings = release.distribution_settings ?? {};
  const coverSongs = Array.isArray(settings.coverSongs)
    ? settings.coverSongs.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : [];
  const providerArtistId =
    Number.isFinite(Number(settings.providerArtistId)) && Number(settings.providerArtistId) > 0
      ? Number(settings.providerArtistId)
      : undefined;

  const releaseContributors = release.release_contributors ?? [];
  const artistRoles = new Set(["primary_artist", "featured_artist", "remixer"]);
  const writerRoles = new Set(["songwriter", "composer", "lyricist"]);
  const toRole = (role: string) =>
    role === "primary_artist"
      ? "primary"
      : role === "featured_artist"
        ? "featured"
        : role.replace(/_/g, " ");

  const releaseArtists = releaseContributors
    .filter((contributor) => !contributor.track_id && artistRoles.has(contributor.role))
    .map((contributor) => ({
      name: contributor.name,
      role: [toRole(contributor.role)],
      ...(contributor.role === "primary_artist" && providerArtistId
        ? { artistId: providerArtistId }
        : {}),
    }));
  if (!releaseArtists.some((artist) => artist.role.includes("primary"))) {
    releaseArtists.unshift({
      name: release.primary_artist_name,
      role: ["primary"],
      ...(providerArtistId ? { artistId: providerArtistId } : {}),
    });
  }

  return {
    releaseId: release.id,
    title: release.title,
    version: release.version,
    type: release.release_type,
    primaryArtistName: release.primary_artist_name,
    primaryArtistProviderId: providerArtistId,
    participants: releaseArtists,
    labelName: release.label_name,
    genre: release.genre,
    subgenre: release.subgenre,
    language: release.language,
    upc: release.upc,
    releaseDate: release.release_date,
    originalReleaseDate: release.original_release_date,
    applePreorder: settings.applePreorder === true,
    applePreorderDate:
      typeof settings.applePreorderDate === "string" ? settings.applePreorderDate : null,
    licenseType:
      typeof settings.licenseType === "string" ? settings.licenseType : null,
    licenseInfo:
      typeof settings.licenseInfo === "string" ? settings.licenseInfo : null,
    reviewNote:
      typeof settings.reviewNote === "string" ? settings.reviewNote : null,
    releaseTime:
      typeof settings.releaseTime === "string" ? settings.releaseTime : null,
    timeZone:
      typeof settings.timeZone === "string" ? settings.timeZone : null,
    isAiGenerated: settings.isAiGenerated === true,
    coverSongs,
    copyrightYear: release.copyright_year,
    copyrightLine: release.copyright_line,
    phonogramLine: release.phonogram_line,
    tracks: tracks.map((track) => {
      const linked = audioAssets.find((asset) => asset.track_id === track.id);
      const legacySingleTrackAudio =
        tracks.length === 1
          ? audioAssets.find((asset) => asset.track_id == null)
          : undefined;
      const audio = linked ?? legacySingleTrackAudio ?? null;

      const scoped = releaseContributors.filter(
        (contributor) => !contributor.track_id || contributor.track_id === track.id
      );
      const artists = scoped
        .filter((contributor) => artistRoles.has(contributor.role))
        .map((contributor) => ({
          name: contributor.name,
          role: [toRole(contributor.role)],
          ...(contributor.role === "primary_artist" && providerArtistId
            ? { artistId: providerArtistId }
            : {}),
        }));
      if (!artists.some((artist) => artist.role.includes("primary"))) {
        artists.unshift({
          name: release.primary_artist_name,
          role: ["primary"],
          ...(providerArtistId ? { artistId: providerArtistId } : {}),
        });
      }
      const writers = scoped
        .filter((contributor) => writerRoles.has(contributor.role))
        .map((contributor) => ({
          name: contributor.name,
          role: [toRole(contributor.role)],
        }));
      const credits = scoped
        .filter(
          (contributor) =>
            !artistRoles.has(contributor.role) && !writerRoles.has(contributor.role)
        )
        .map((contributor) => ({
          name: contributor.name,
          role: [toRole(contributor.role)],
        }));

      return {
        trackId: track.id,
        trackNumber: track.track_number,
        title: track.title,
        version: track.version,
        isrc: track.isrc,
        iswc: track.iswc,
        linerNote: track.liner_note,
        tiktokStartTime: track.tiktok_start_time,
        language: track.language,
        explicit: track.explicit,
        cleanVersion: track.clean_version,
        instrumental: track.instrumental,
        lyrics: track.lyrics,
        aiAssisted: track.ai_assisted,
        artists,
        writers,
        credits,
        audioStorageBucket: audio?.storage_bucket ?? null,
        audioStoragePath: audio?.storage_path ?? null,
        audioFilename: audio?.filename ?? null,
        audioMimeType: audio ? "audio/flac" : null,
      };
    }),
    artworkStorageBucket: artwork?.storage_bucket ?? null,
    artworkStoragePath: artwork?.storage_path ?? null,
    artworkFilename: artwork?.filename ?? null,
    artworkMimeType: artwork?.mime_type ?? null,
    territories: release.territories ?? [],
    deliverySettings: release.distribution_settings ?? {},
  };
}

function validateProviderPayloadBeforeAttempt(payload: ProviderReleasePayload): string | null {
  if (!payload.artworkStorageBucket || !payload.artworkStoragePath) {
    return "Cover artwork is required before Nexo delivery.";
  }
  if (!payload.tracks.length) {
    return "At least one track is required before Nexo delivery.";
  }
  for (const track of payload.tracks) {
    if (!track.audioStorageBucket || !track.audioStoragePath) {
      return `Track ${track.trackNumber} is missing linked audio.`;
    }
    if (track.audioMimeType !== "audio/flac") {
      return `Track ${track.trackNumber} must use lossless FLAC audio for Nexo delivery. Re-upload this track as FLAC before retrying.`;
    }
  }
  return null;
}

/**
 * Idempotent submission of a queued job. Connection/media preflight happens before
 * an attempt row is opened so predictable operator fixes do not create fake failures.
 */
export async function submitQueuedRelease(
  jobId: string,
  idempotencyKey: string
): Promise<DistActionResult> {
  const supabase = await createClient();
  const service = createServiceClient();

  const state = await getProviderConnectionState();
  const provider = getProvider();
  if (!state.connected || !provider.connected) {
    return {
      ok: false,
      error: "Distribution Engine authorization is unavailable. Reconnect it from the secure admin integration.",
      code: PROVIDER_NOT_CONNECTED_CODE,
    };
  }

  const { data: job, error: jobError } = await supabase
    .from("distribution_jobs")
    .select("id, release_id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) return { ok: false, error: jobError.message };
  if (!job) return { ok: false, error: "Distribution job not found." };

  const { data: release, error: releaseError } = await supabase
    .from("releases")
    .select("*, release_tracks(*), release_assets(*), release_contributors(*)")
    .eq("id", job.release_id)
    .maybeSingle();
  if (releaseError) return { ok: false, error: releaseError.message };
  if (!release) return { ok: false, error: "Release not found." };

  const providerPayload = providerPayloadFromRelease(release as unknown as DistributionReleaseRecord);
  const preflightError = validateProviderPayloadBeforeAttempt(providerPayload);
  if (preflightError) {
    return {
      ok: false,
      error: preflightError,
      code: PROVIDER_DELIVERY_VALIDATION_CODE,
    };
  }

  const { data: begin, error: beginErr } = await supabase.rpc("begin_submit_queued_release", {
    p_job_id: jobId,
    p_idempotency_key: idempotencyKey,
  });
  if (beginErr) return { ok: false, error: beginErr.message };

  const began = begin as {
    idempotent?: boolean;
    submission_id: string;
    release_id?: string;
    status?: string;
    provider_release_id?: string;
  };
  if (began.idempotent) return { ok: true, data: began };

  try {
    const result = await provider.submitRelease(providerPayload);

    const { data, error } = await service.rpc("complete_submit_queued_release", {
      p_submission_id: began.submission_id,
      p_ok: true,
      p_provider_release_id: result.providerReleaseId,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err) {
    const payload = toProviderErrorPayload(err);
    const { data, error } = await service.rpc("complete_submit_queued_release", {
      p_submission_id: began.submission_id,
      p_ok: false,
      p_error_code: payload.code,
      p_error_message: payload.message,
    });
    if (error) return { ok: false, error: error.message, code: payload.code };
    return { ok: false, error: payload.message, code: payload.code, data };
  }
}

export async function syncReleaseStatus(jobId: string): Promise<DistActionResult> {
  const supabase = await createClient();
  const service = createServiceClient();
  const state = await getProviderConnectionState();

  if (!state.connected) {
    const { data, error } = await supabase.rpc("record_provider_sync_run", {
      p_job_id: jobId,
      p_status: "unavailable",
      p_error_message: "Distribution Engine authorization is unavailable — sync cannot run yet.",
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: false,
      error: "Distribution Engine authorization is unavailable.",
      code: PROVIDER_NOT_CONNECTED_CODE,
      data,
    };
  }

  const { data: job } = await supabase
    .from("distribution_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (!job?.provider_release_id) {
    await supabase.rpc("record_provider_sync_run", {
      p_job_id: jobId,
      p_status: "unavailable",
      p_error_message: "Awaiting provider submission — submit this queued job before syncing status.",
    });
    return {
      ok: false,
      error: "Awaiting provider submission. Submit this queued job before syncing status.",
      code: "AWAITING_PROVIDER_SUBMISSION",
    };
  }

  const provider = getProvider();
  try {
    const delivery = await provider.getDeliveryStatus(job.provider_release_id);
    const mapped = mapProviderStatusToRelease(delivery.deliveryStatus);

    const { error: snapshotError } = await service
      .from("provider_delivery_snapshots")
      .insert({
        job_id: job.id,
        release_id: job.release_id,
        provider_name: job.provider_name,
        provider_release_id: job.provider_release_id,
        release_status: delivery.deliveryStatus,
        dsp_statuses: delivery.dspStatuses ?? [],
        source: "api_sync",
      });

    const { data: currentRelease } = await supabase
      .from("releases")
      .select("status")
      .eq("id", job.release_id)
      .maybeSingle();

    let run: unknown;
    if (mapped && currentRelease?.status !== mapped) {
      const { data, error } = await supabase.rpc("apply_provider_sync_status", {
        p_job_id: jobId,
        p_mapped_status: mapped,
        p_provider_status: delivery.deliveryStatus,
      });
      if (error) return { ok: false, error: error.message };
      run = data;
    } else {
      const { data, error } = await supabase.rpc("record_provider_sync_run", {
        p_job_id: jobId,
        p_status: "succeeded",
        p_provider_status: delivery.deliveryStatus,
        p_delivery_status: mapped ?? delivery.deliveryStatus,
      });
      if (error) return { ok: false, error: error.message };
      run = data;
    }

    if (mapped === "live") {
      try {
        const { drainFanlinkSyncJobs } = await import("@/lib/fanlink/jobs");
        await drainFanlinkSyncJobs(5);
      } catch {
        // Delivery sync remains successful; fanlink retry can remain queued.
      }
    }

    return {
      ok: true,
      data: {
        run,
        status: delivery,
        mapped,
        ...(snapshotError
          ? { snapshotWarning: "Provider status synced, but the delivery-history snapshot could not be stored." }
          : {}),
      },
    };
  } catch (err) {
    const payload = toProviderErrorPayload(err);
    await supabase.rpc("record_provider_sync_run", {
      p_job_id: jobId,
      p_status: payload.code === PROVIDER_NOT_CONNECTED_CODE ? "unavailable" : "failed",
      p_error_message: payload.message,
    });
    return { ok: false, error: payload.message, code: payload.code };
  }
}

export async function requestTakedownAction(
  releaseId: string,
  reason?: string
): Promise<DistActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_distribution_takedown", {
    p_release_id: releaseId,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };

  // Provider call only if connected + has provider id — never fake success
  const state = await getProviderConnectionState();
  if (state.connected && data?.provider_release_id) {
    try {
      await getProvider().requestTakedown(data.provider_release_id, reason);
    } catch (err) {
      const payload = toProviderErrorPayload(err);
      return {
        ok: true,
        data: {
          release: data,
          providerWarning: payload.message,
        },
      };
    }
  }

  return { ok: true, data };
}

export async function reinstateReleaseAction(
  releaseId: string,
  reason?: string
): Promise<DistActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reinstate_distribution_release", {
    p_release_id: releaseId,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };

  const state = await getProviderConnectionState();
  if (state.connected && data?.provider_release_id) {
    try {
      await getProvider().reinstateRelease(data.provider_release_id, reason);
    } catch (err) {
      const payload = toProviderErrorPayload(err);
      return { ok: true, data: { release: data, providerWarning: payload.message } };
    }
  }

  return { ok: true, data };
}

export async function retryFailedJob(jobId: string): Promise<DistActionResult> {
  const key = `retry:${jobId}:${Date.now()}`;
  // Re-queue by setting status via submit path — require staff RPC begin after resetting
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("distribution_jobs")
    .select("release_id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { ok: false, error: "Job not found" };
  if (job.status !== "failed") return { ok: false, error: "Only failed jobs can be retried" };

  const queued = await queueApprovedRelease(job.release_id, "Retry after failure");
  if (!queued.ok) return queued;

  const newJobId = (queued.data as { id?: string })?.id ?? jobId;
  return submitQueuedRelease(newJobId, key);
}
