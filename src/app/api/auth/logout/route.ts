import { NextResponse } from "next/server";
import { LOGIN_PATH, NEXO_OTP_CHALLENGE_COOKIE } from "@/lib/auth/login-otp/constants";
import { logoutNexoSession } from "@/lib/auth/login-otp/server";
import { authEmailRedirectUrl } from "@/lib/site-url";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientIpFromRequest,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limited = checkRateLimit({
    key: `logout:${ip}`,
    ...RATE_LIMITS.authSensitive,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  await logoutNexoSession();

  const res = NextResponse.json(
    {
      ok: true,
      redirectTo: LOGIN_PATH,
      loginUrl: authEmailRedirectUrl(LOGIN_PATH),
    },
    { headers: { ...rateLimitHeaders(limited), "Cache-Control": "no-store" } }
  );
  res.cookies.set({
    name: NEXO_OTP_CHALLENGE_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
