"use server";

import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  assertCmsMediaFile,
  buildCmsMediaPath,
  CMS_MEDIA_BUCKET,
  registerCmsMedia,
} from "@/lib/cms/media";

export async function uploadCmsMediaAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:website");
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false as const, error: "File required." };
  }
  const err = assertCmsMediaFile({ type: file.type, size: file.size });
  if (err) return { ok: false as const, error: err };

  const id = crypto.randomUUID();
  const path = buildCmsMediaPath(ctx.userId, file.name, id);
  const supabase = await createClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(CMS_MEDIA_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false as const, error: upErr.message };

  const row = await registerCmsMedia({
    storagePath: path,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedBy: ctx.userId,
  });

  const { data: pub } = supabase.storage.from(CMS_MEDIA_BUCKET).getPublicUrl(path);
  return { ok: true as const, data: { ...row, publicUrl: pub.publicUrl } };
}
