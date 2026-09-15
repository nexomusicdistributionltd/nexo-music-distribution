import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  authCallbackNext,
  recoveryFailurePath,
} from "@/lib/auth/recovery-urls";
import { authAppOrigin } from "@/lib/site-url";
import { getSupabaseEnv } from "@/lib/supabase/env";

type AuthRedirectMode = "pkce" | "otp";

/**
 * Complete PKCE code exchange or token_hash OTP on the server and attach
 * session cookies to the redirect. Using next/headers cookies() + a separate
 * NextResponse.redirect can drop Set-Cookie — bind cookies to the redirect.
 */
export async function completeAuthRedirect(
  request: NextRequest,
  mode: AuthRedirectMode
): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const origin = authAppOrigin(requestUrl.origin);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = authCallbackNext(requestUrl.searchParams.get("next"), type);

  const { url, anonKey, configured } = getSupabaseEnv();
  if (!configured) {
    return NextResponse.redirect(new URL("/login?reason=supabase-not-configured", origin));
  }

  const fail = () =>
    NextResponse.redirect(new URL(recoveryFailurePath(next, type), origin));

  const redirect = NextResponse.redirect(new URL(next, origin));
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          redirect.cookies.set(name, value, options);
        });
      },
    },
  });

  if (mode === "otp" && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    return error ? fail() : redirect;
  }

  if (mode === "pkce" && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? fail() : redirect;
  }

  // OTP route may also receive a PKCE code (default ConfirmationURL).
  if (mode === "otp" && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? fail() : redirect;
  }

  return fail();
}
