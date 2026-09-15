import { NextResponse } from "next/server";
import { getPasswordSessionIdentity, startLoginOtp } from "@/lib/auth/login-otp/server";
import { homePathForRoles } from "@/lib/auth/types";
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
    key: `otp:resend:${identity?.userId ?? ip}`,
    ...RATE_LIMITS.otpGenerate,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many verification requests. Please wait." },
      { status: 429, headers: rateLimitHeaders(limited) }
    );
  }

  const result = await startLoginOtp({ resend: true });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status, headers: rateLimitHeaders(limited) }
    );
  }

  if ("alreadyVerified" in result && result.alreadyVerified) {
    return NextResponse.json(
      { ok: true, alreadyVerified: true, redirectTo: homePathForRoles(identity?.roles ?? []) },
      { headers: rateLimitHeaders(limited) }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      challengeId: result.challengeId,
      maskedEmail: result.maskedEmail,
      expiresAt: result.expiresAt,
      resendAvailableAt: result.resendAvailableAt,
      resent: true,
    },
    { headers: rateLimitHeaders(limited) }
  );
}
