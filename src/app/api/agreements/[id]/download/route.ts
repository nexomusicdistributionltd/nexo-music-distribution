import { NextResponse } from "next/server";
import { RequireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await RequireAuth();
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("distribution_agreement_executions")
    .select("id, agreement_version, document_html, client_signed_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Signed agreement not found." }, { status: 404 });
  }

  const safeVersion = String(data.agreement_version).replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `Nexo_Music_Distribution_Agreement_${safeVersion}_${data.id}.html`;

  return new NextResponse(data.document_html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
