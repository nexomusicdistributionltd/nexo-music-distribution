import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Readiness: app process up + DB reachable (anon). Providers may be NOT CONNECTED. */
export async function GET() {
  const env = getSupabaseEnv();
  if (!env.configured) {
    return NextResponse.json(
      { ok: false, ready: false, reason: "supabase_env_missing" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const client = createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.from("profiles").select("id").limit(1);
    if (
      error &&
      /fetch failed|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(error.message)
    ) {
      return NextResponse.json(
        { ok: false, ready: false, reason: "database_unreachable" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { ok: true, ready: true, database: "reachable" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, ready: false, reason: "database_unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
