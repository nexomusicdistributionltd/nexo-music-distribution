import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireEmailCenterApi } from "@/lib/email/api-guard";
import { EMAIL_ATTACHMENTS_BUCKET } from "@/lib/email/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requireEmailCenterApi();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_inbox_attachments")
    .select("id, filename, content_type, trusted, storage_bucket, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  if (!data.trusted || !data.storage_path) {
    return NextResponse.json(
      { ok: false, error: "Untrusted attachment is not downloadable." },
      { status: 403 }
    );
  }
  const bucket = data.storage_bucket || EMAIL_ATTACHMENTS_BUCKET;
  const { data: file, error: dlErr } = await supabase.storage.from(bucket).download(data.storage_path);
  if (dlErr || !file) {
    return NextResponse.json({ ok: false, error: "Download failed" }, { status: 404 });
  }
  const bytes = await file.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": data.content_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(data.filename)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
