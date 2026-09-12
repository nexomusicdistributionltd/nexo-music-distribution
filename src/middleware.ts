import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getSupabaseEnv } from "@/lib/supabase/env";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/releases",
  "/earnings",
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { configured } = getSupabaseEnv();
  const { supabaseResponse, user, supabase } = await updateSession(request);

  const isProtected = startsWithAny(pathname, PROTECTED_PREFIXES);
  const isAuthPage = AUTH_PAGES.includes(pathname);

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
      .select("account_status")
      .eq("id", user.id)
      .maybeSingle();

    const status = profile?.account_status as string | undefined;
    if (status === "suspended" || status === "deactivated") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "account-blocked");
      // Clear session cookies by redirecting; client logout preferred but block access
      const res = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
      return res;
    }

    const verified = Boolean(user.email_confirmed_at);
    if (!verified && !startsWithAny(pathname, UNVERIFIED_ALLOW)) {
      const url = request.nextUrl.clone();
      url.pathname = "/verify-email";
      const res = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
      return res;
    }

    // Role-based admin gate (coarse — layouts re-check)
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const list = (roles ?? []).map((r) => r.role as string);
      if (!list.includes("admin") && !list.includes("super_admin")) {
        const url = request.nextUrl.clone();
        if (list.includes("support")) url.pathname = "/support";
        else if (list.includes("artist") || list.includes("label")) url.pathname = "/dashboard";
        else url.pathname = "/profile";
        const res = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
        return res;
      }
    }
  }

  // Redirect signed-in users away from login/register toward their home
  if (user && supabase && isAuthPage) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const list = (roles ?? []).map((r) => r.role as string);
    const url = request.nextUrl.clone();
    if (!user.email_confirmed_at) url.pathname = "/verify-email";
    else if (list.includes("admin") || list.includes("super_admin")) url.pathname = "/admin";
    else if (list.includes("support")) url.pathname = "/support";
    else url.pathname = "/dashboard";
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
    return res;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/releases/:path*",
    "/earnings/:path*",
    "/analytics/:path*",
    "/profile/:path*",
    "/app/:path*",
    "/support/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/verify-email",
  ],
};
