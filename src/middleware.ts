import { NextResponse, type NextRequest } from "next/server";
import {
  applyCookies,
  expireSupabaseAuthCookies,
  updateSession,
} from "@/lib/supabase/middleware";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { LOGIN_OTP_VERIFY_PATH, NEXO_OTP_CHALLENGE_COOKIE } from "@/lib/auth/login-otp/constants";
import { isOtpPendingAllowedPath } from "@/lib/auth/login-otp/paths";
import { adminPermissionForPath, hasAdminPermission } from "@/lib/admin/permissions";
import type { AppRole } from "@/lib/auth/types";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/releases",
  "/earnings",
  "/billing",
  "/analytics",
  "/profile",
  "/app",
  "/support",
  "/admin",
];

const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

/** Routes unverified users may access while signed in */
const UNVERIFIED_ALLOW = ["/profile", "/verify-email", "/auth"];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isBlockedStatus(status: string | null | undefined) {
  return status === "suspended" || status === "deactivated";
}

function isLoginRestricted(
  status: string | null | undefined,
  restriction: string | null | undefined
) {
  return isBlockedStatus(status) || restriction === "login_restricted";
}

function blockedLoginUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("reason", "account-blocked");
  return url;
}

function expireNexoOtpCookie(response: NextResponse) {
  response.cookies.set({
    name: NEXO_OTP_CHALLENGE_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
  return response;
}

/**
 * Sign out + expire auth cookies, then send the user to /login?reason=account-blocked.
 * Must not copy a live session onto the redirect (that caused a login↔dashboard loop).
 */
async function clearSessionAndRedirectBlocked(
  request: NextRequest,
  supabase: NonNullable<Awaited<ReturnType<typeof updateSession>>["supabase"]>,
  getResponse: () => NextResponse
) {
  try {
    await supabase.rpc("nexo_login_otp_invalidate_current");
  } catch {
    /* ignore */
  }
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // Still expire cookies locally if the API call fails
  }

  const url = blockedLoginUrl(request);
  // Stay on /login if already there (after cookies are cleared) to avoid a self-redirect hop
  const alreadyOnBlockedLogin =
    request.nextUrl.pathname === "/login" &&
    request.nextUrl.searchParams.get("reason") === "account-blocked";

  const res = alreadyOnBlockedLogin
    ? NextResponse.next({ request })
    : NextResponse.redirect(url);

  // Apply signOut mutations (expired/empty auth cookies), then force-expire leftovers
  applyCookies(getResponse(), res);
  expireSupabaseAuthCookies(request, res);
  expireNexoOtpCookie(res);
  return res;
}

function redirectWithSession(
  url: URL,
  getResponse: () => NextResponse
) {
  const res = NextResponse.redirect(url);
  applyCookies(getResponse(), res);
  return res;
}

async function isOtpVerified(
  supabase: NonNullable<Awaited<ReturnType<typeof updateSession>>["supabase"]>
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("nexo_login_otp_verified");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { configured } = getSupabaseEnv();
  const { getResponse, user, supabase } = await updateSession(request);

  const isProtected = startsWithAny(pathname, PROTECTED_PREFIXES);
  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isVerifyPage = pathname === LOGIN_OTP_VERIFY_PATH || pathname.startsWith(`${LOGIN_OTP_VERIFY_PATH}/`);

  if (isProtected && !configured) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "supabase-not-configured");
    return NextResponse.redirect(url);
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    url.searchParams.set("reason", "auth-required");
    return NextResponse.redirect(url);
  }

  if (user && supabase && isProtected) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status, restriction_kind")
      .eq("id", user.id)
      .maybeSingle();

    if (
      isLoginRestricted(
        profile?.account_status as string | undefined,
        profile?.restriction_kind as string | undefined
      )
    ) {
      return clearSessionAndRedirectBlocked(request, supabase, getResponse);
    }

    const verified = Boolean(user.email_confirmed_at);
    if (!verified && !startsWithAny(pathname, UNVERIFIED_ALLOW)) {
      const url = request.nextUrl.clone();
      url.pathname = "/verify-email";
      return redirectWithSession(url, getResponse);
    }

    if (verified && !isOtpPendingAllowedPath(pathname)) {
      const otpOk = await isOtpVerified(supabase);
      if (!otpOk) {
        const url = request.nextUrl.clone();
        url.pathname = LOGIN_OTP_VERIFY_PATH;
        url.search = "";
        url.searchParams.set("from", pathname);
        url.searchParams.set("reason", "otp-required");
        return redirectWithSession(url, getResponse);
      }
    }

    // Role-based admin gate (coarse — layouts re-check)
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const list = (roles ?? []).map((r) => r.role as AppRole);
      if (
        !list.includes("admin") &&
        !list.includes("super_admin") &&
        !list.includes("support")
      ) {
        const url = request.nextUrl.clone();
        if (list.includes("artist") || list.includes("label")) url.pathname = "/dashboard";
        else url.pathname = "/profile";
        return redirectWithSession(url, getResponse);
      }

      const requiredPermission = adminPermissionForPath(pathname);
      if (requiredPermission && !hasAdminPermission(list, requiredPermission)) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        url.search = "";
        url.searchParams.set("reason", "forbidden");
        return redirectWithSession(url, getResponse);
      }
    }
  }

  // Signed-in visitors on /nexo-admin — admin/super_admin → /admin only after OTP;
  // support and other roles stay on the page (AccessDenied UI). Do NOT treat like AUTH_PAGES.
  if (user && supabase && pathname === "/nexo-admin") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status, restriction_kind")
      .eq("id", user.id)
      .maybeSingle();

    if (
      isLoginRestricted(
        profile?.account_status as string | undefined,
        profile?.restriction_kind as string | undefined
      )
    ) {
      return clearSessionAndRedirectBlocked(request, supabase, getResponse);
    }

    if (!user.email_confirmed_at) {
      const url = request.nextUrl.clone();
      url.pathname = "/verify-email";
      return redirectWithSession(url, getResponse);
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const list = (roles ?? []).map((r) => r.role as string);
    if (list.includes("admin") || list.includes("super_admin")) {
      const otpOk = await isOtpVerified(supabase);
      const url = request.nextUrl.clone();
      if (!otpOk) {
        url.pathname = LOGIN_OTP_VERIFY_PATH;
        url.search = "";
        url.searchParams.set("from", "/admin");
        url.searchParams.set("entry", "nexo-admin");
        return redirectWithSession(url, getResponse);
      }
      url.pathname = "/admin";
      url.search = "";
      return redirectWithSession(url, getResponse);
    }

    return getResponse();
  }

  if (user && supabase && isVerifyPage) {
    const otpOk = await isOtpVerified(supabase);
    if (otpOk) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const list = (roles ?? []).map((r) => r.role as string);
      const url = request.nextUrl.clone();
      if (list.includes("admin") || list.includes("super_admin") || list.includes("support")) {
        url.pathname = "/admin";
      } else {
        url.pathname = "/dashboard";
      }
      url.search = "";
      return redirectWithSession(url, getResponse);
    }
    return getResponse();
  }

  // Signed-in visitors on login/register/forgot-password
  if (user && supabase && isAuthPage) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status, restriction_kind")
      .eq("id", user.id)
      .maybeSingle();

    // Blocked / login-restricted accounts must never be bounced into /dashboard|/admin|/support
    if (
      isLoginRestricted(
        profile?.account_status as string | undefined,
        profile?.restriction_kind as string | undefined
      )
    ) {
      return clearSessionAndRedirectBlocked(request, supabase, getResponse);
    }

    if (!user.email_confirmed_at) {
      const url = request.nextUrl.clone();
      url.pathname = "/verify-email";
      return redirectWithSession(url, getResponse);
    }

    const otpOk = await isOtpVerified(supabase);
    if (!otpOk) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_OTP_VERIFY_PATH;
      url.search = "";
      return redirectWithSession(url, getResponse);
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const list = (roles ?? []).map((r) => r.role as string);
    const url = request.nextUrl.clone();
    if (list.includes("admin") || list.includes("super_admin")) url.pathname = "/admin";
    else if (list.includes("support")) url.pathname = "/admin";
    else url.pathname = "/dashboard";
    return redirectWithSession(url, getResponse);
  }

  return getResponse();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/releases/:path*",
    "/earnings/:path*",
    "/billing/:path*",
    "/billing",
    "/analytics/:path*",
    "/profile/:path*",
    "/app/:path*",
    "/support/:path*",
    "/admin/:path*",
    "/login",
    "/login/verify",
    "/register",
    "/forgot-password",
    "/verify-email",
    "/nexo-admin",
  ],
};
