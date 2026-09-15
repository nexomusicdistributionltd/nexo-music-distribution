import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireEmailCenterApi } from "@/lib/email/api-guard";
import { syncZohoInbox } from "@/lib/email/inbox-sync";
import { RATE_LIMITS, checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cron = request.headers.get("authorization");
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const isCron = Boolean(cronSecret) && cron === `Bearer ${cronSecret}`;

  if (!isCron) {
    const gate = await requireEmailCenterApi();
    if (!gate.ok) return gate.response;
    const limited = checkRateLimit({
      key: `email-sync:${gate.ctx.userId}`,
      ...RATE_LIMITS.adminMutation,
    });
    if (!limited.ok) {
      return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
    }
  }

  const supabase = await createClient();
  const result = await syncZohoInbox(supabase, { limit: 50 });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, upserted: result.upserted });
}
