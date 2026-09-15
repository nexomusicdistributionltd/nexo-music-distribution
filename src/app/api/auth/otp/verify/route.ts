import { NextResponse } from "next/server";
import { getPasswordSessionIdentity, verifyLoginOtp } from "@/lib/auth/login-otp/server";
import { safeRedirectPath } from "@/lib/auth/safeRedirect";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIpFromRequest,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const identity = await getPasswordSessionIdentity();
  const limited = checkRateLimit({
    key: `otp:verify:${identity?.userId ?? ip}`,
    ...RATE_LIMITS.otpVerify,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait." },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  let body: { code?: string; from?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await verifyLoginOtp(body.code ?? "");
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, locked: Boolean(result.locked) },
      { status: result.status, headers: rateLimitHeaders(limited) }
    );
  }

  const redirectTo = safeRedirectPath(body.from, identity?.roles ?? [], result.redirectTo);
  return NextResponse.json(
    { ok: true, redirectTo },
    { headers: rateLimitHeaders(limited) }
  );
}
