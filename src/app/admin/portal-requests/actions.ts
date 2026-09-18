"use server";

import { revalidatePath } from "next/cache";
import { RequireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  getMusicVideoProviderStatus,
  submitMusicVideoToProvider,
  VideoDistributionError,
} from "@/lib/provider/video-distribution";

function textValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function reviewMusicVideoAction(formData: FormData): Promise<void> {
  const ctx = await RequireAdmin();
  const id = textValue(formData, "id");
  const decision = textValue(formData, "decision");
  const note = textValue(formData, "note");
  if (!id) return;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("music_video_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;

  if (decision === "reject") {
    await supabase
      .from("music_video_submissions")
      .update({
        status: "rejected",
        admin_note: note || "Music video requires changes before distribution.",
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
        provider_error: null,
      })
      .eq("id", id);
    revalidatePath("/admin/portal-requests");
    revalidatePath("/dashboard/videos");
    return;
  }

  if (decision === "sync" && row.provider_release_id) {
    try {
      const status = await getMusicVideoProviderStatus(row.provider_release_id);
      const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
      await supabase
        .from("music_video_submissions")
        .update({
          provider_status: status,
          status: normalized === "live" ? "live" : "provider_submitted",
          provider_error: null,
        })
        .eq("id", id);
    } catch (error) {
      await supabase
        .from("music_video_submissions")
        .update({
          provider_error:
            error instanceof Error ? error.message : "Provider status sync failed.",
        })
        .eq("id", id);
    }
    revalidatePath("/admin/portal-requests");
    revalidatePath("/dashboard/videos");
    return;
  }

  if (decision !== "approve") return;

  const settings =
    row.distribution_settings &&
    typeof row.distribution_settings === "object" &&
    !Array.isArray(row.distribution_settings)
      ? (row.distribution_settings as Record<string, unknown>)
      : {};
  const providerArtistId =
    Number.isFinite(Number(settings.providerArtistId)) &&
    Number(settings.providerArtistId) > 0
      ? Number(settings.providerArtistId)
      : null;

  try {
    const result = await submitMusicVideoToProvider({
      requestId: row.id,
      title: row.title,
      primaryArtistName: row.primary_artist_name ?? "",
      providerArtistId,
      labelName: row.label_name,
      genre: row.genre,
      language: row.language,
      releaseDate: row.release_date,
      videoUrl: row.video_url,
      videoType: row.video_type,
      ageRestriction: row.age_restriction,
      isCoverVersion: row.is_cover_version,
      referenceUpc: row.reference_upc,
      referenceIsrc: row.reference_isrc,
      deliverAppleMusic: row.deliver_apple_music,
      deliverVevo: row.deliver_vevo,
    });

    await supabase
      .from("music_video_submissions")
      .update({
        status: "provider_submitted",
        admin_note: note || null,
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
        provider_release_id: result.providerReleaseId,
        provider_status: result.status,
        provider_error: null,
        provider_submitted_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch (error) {
    const accessRequired =
      error instanceof VideoDistributionError &&
      error.code === "VIDEO_ACCESS_REQUIRED";
    await supabase
      .from("music_video_submissions")
      .update({
        status: accessRequired ? "provider_access_required" : "failed",
        admin_note: note || null,
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
        provider_error:
          error instanceof Error ? error.message : "Music-video provider submission failed.",
      })
      .eq("id", id);
  }

  revalidatePath("/admin/portal-requests");
  revalidatePath("/dashboard/videos");
}
