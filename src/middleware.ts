import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Batch 1 middleware stub.
 * Portal/admin routes are reserved; auth is not connected — do not fabricate sessions.
 * Wire real auth before allowing access.
 */
const RESERVED_PREFIXES = ["/portal", "/admin", "/support"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (RESERVED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    url.searchParams.set("reason", "auth-not-connected");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*", "/support/:path*"],
};
