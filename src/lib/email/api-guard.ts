import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/session";
import { canAccessEmailCenter } from "@/lib/email/access";

export async function requireEmailCenterApi() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canAccessEmailCenter(ctx.roles)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, ctx };
}
