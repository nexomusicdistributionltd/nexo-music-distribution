import "server-only";

import { createClient } from "@/lib/supabase/server";

export const CMS_MEDIA_BUCKET = "cms-media";
export const CMS_MEDIA_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const MAX_CMS_MEDIA_BYTES = 20 * 1024 * 1024;

export function assertCmsMediaFile(file: { type: string; size: number }): string | null {
  if (!(CMS_MEDIA_MIME as readonly string[]).includes(file.type)) {
    return "CMS media must be JPEG, PNG, WebP, or GIF.";
  }
  if (file.size <= 0 || file.size > MAX_CMS_MEDIA_BYTES) {
    return "CMS media must be between 1 byte and 20MB.";
  }
  return null;
}

export function buildCmsMediaPath(userId: string, filename: string, id: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
  if (!userId || userId.includes("..") || userId.includes("/")) {
    throw new Error("Invalid userId");
  }
  return `${userId}/${id}-${safe}`;
}

export async function registerCmsMedia(input: {
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
  altText?: string;
  uploadedBy: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cms_media")
    .insert({
      storage_bucket: CMS_MEDIA_BUCKET,
      storage_path: input.storagePath,
      filename: input.filename,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes ?? null,
      alt_text: input.altText ?? null,
      uploaded_by: input.uploadedBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
