import { NextResponse } from "next/server";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { getErnDownload } from "@/lib/ddex/admin-ops";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const ctx = await RequireAdminPermission("admin:ddex");
  const { messageId } = await params;
  const res = await getErnDownload(messageId);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 404 });
  }
  const supabase = await createClient();
  await supabase.rpc("write_audit_log", {
    p_action: "ddex_download",
    p_entity_type: "ddex_message",
    p_entity_id: null,
    p_metadata: { messageId, actor: ctx.userId },
  });
  return new NextResponse(res.xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${res.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
