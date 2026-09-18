import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { id } = await params;
  const service = createServiceClient();
  const { data: agreement } = await service
    .from("distribution_agreements")
    .select("id,user_id,pdf_path,agreement_version,legal_name")
    .eq("id", id)
    .maybeSingle();

  if (!agreement?.pdf_path) {
    return NextResponse.json({ error: "Agreement document not found" }, { status: 404 });
  }
  const staff =
    ctx.roles.includes("support") ||
    ctx.roles.includes("admin") ||
    ctx.roles.includes("super_admin");
  if (!staff && agreement.user_id !== ctx.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service.storage
    .from("distribution-agreements")
    .download(agreement.pdf_path);
  if (error || !data) {
    return NextResponse.json({ error: "Agreement document unavailable" }, { status: 404 });
  }

  const bytes = await data.arrayBuffer();
  const safeName = String(agreement.legal_name || "Client").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Nexo-Distribution-Agreement-${safeName}-v${agreement.agreement_version}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
