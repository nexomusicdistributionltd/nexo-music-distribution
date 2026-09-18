import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getProvider, getProviderConnectionState } from "@/lib/provider";
import { toProviderErrorPayload, PROVIDER_NOT_CONNECTED_CODE } from "@/lib/provider/errors";
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
export async function submitQueuedRelease(
  jobId: string,
  idempotencyKey: string
): Promise<DistActionResult> {
  const supabase = await createClient();
  const service = createServiceClient();
  const provider = getProvider();
  const state = await getProviderConnectionState();

  if (!state.connected || !provider.connected) {
    return {
      ok: false,
      error: "Distribution Engine authorization is unavailable.",
      code: PROVIDER_NOT_CONNECTED_CODE,
    };
  }

  // Older queued rows may have been created before the live Distribution Engine
  // was authorized and therefore carry the placeholder provider name. Normalize
  // the private job identity before the idempotent submission record is created.
  const { data: existingJob, error: jobReadError } = await service
    .from("distribution_jobs")
    .select("id,release_id,provider_name")
    .eq("id", jobId)
    .maybeSingle();
  if (jobReadError || !existingJob) {
    return { ok: false, error: "Distribution job not found." };
  }
  if (existingJob.provider_name !== provider.name) {
    const { error: normalizeError } = await service
      .from("distribution_jobs")
      .update({ provider_name: provider.name, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    if (normalizeError) {
      return {
        ok: false,
        error: "Could not prepare the distribution job for delivery.",
      };
    }
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

  if (began.idempotent) {
    return { ok: true, data: began };
  }

  const { data: release } = await supabase
    .from("releases")
    .select("*, release_tracks(*)")
    .eq("id", began.release_id!)
    .maybeSingle();

  if (!release) {
    await service.rpc("complete_submit_queued_release", {
      p_submission_id: began.submission_id,
      p_ok: false,
      p_error_code: "RELEASE_NOT_FOUND",
      p_error_message: "Release not found for submission",
    });
    return { ok: false, error: "Release not found" };
  }

  try {
    const result = await provider.submitRelease({
      releaseId: release.id,
      title: release.title,
      type: release.release_type,
      primaryArtistName: release.primary_artist_name,
      upc: release.upc,
      releaseDate: release.release_date,
      tracks: (release.release_tracks ?? []).map(
        (track: {
          track_number: number;
          title: string;
          isrc: string | null;
        }) => ({
          trackNumber: track.track_number,
          title: track.title,
          isrc: track.isrc,
        })
      ),
      territories: release.territories ?? [],
    });

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
  const state = await getProviderConnectionState();

  if (!state.connected) {
    const { data, error } = await supabase.rpc("record_provider_sync_run", {
      p_job_id: jobId,
      p_status: "unavailable",
      p_error_message: "Provider Not Connected — sync unavailable.",
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: false,
      error: "Provider Not Connected / Unavailable",
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
      p_status: "failed",
      p_error_message: "No provider_release_id on job — nothing to sync.",
    });
    return { ok: false, error: "No provider release id" };
  }

  const provider = getProvider();
  try {
    const status = await provider.syncRelease(job.provider_release_id);
    const mapped = mapProviderStatusToRelease(status.status);

    if (mapped) {
      // Staff RPC sets trusted GUC — never call transition_release_status with spoofable source.
      const { data, error } = await supabase.rpc("apply_provider_sync_status", {
        p_job_id: jobId,
        p_mapped_status: mapped,
        p_provider_status: status.status,
      });
      if (error) return { ok: false, error: error.message };
      if (mapped === "live") {
        try { const { drainFanlinkSyncJobs } = await import("@/lib/fanlink/jobs"); await drainFanlinkSyncJobs(5); } catch { /* release sync succeeds even if fanlink retry remains queued */ }
      }
      return { ok: true, data: { run: data, status, mapped } };
    }

    const { data, error } = await supabase.rpc("record_provider_sync_run", {
      p_job_id: jobId,
      p_status: "succeeded",
      p_provider_status: status.status,
      p_delivery_status: mapped,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { run: data, status, mapped } };
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
