import { type NextRequest, NextResponse } from "next/server";
import { completeAuthRedirect } from "@/lib/supabase/auth-redirect";
import { verifyDistributionOAuthState } from "@/lib/provider/oauth/state";
import { exchangeDistributionAuthorizationCode } from "@/lib/provider/oauth/token";
import { verifyDistributionIdentity } from "@/lib/provider/oauth/client";

/**
 * Shared callback URL.
 * Distribution OAuth is recognized only by Nexo-signed state; all other
 * callback traffic remains on the existing Supabase PKCE path.
 *
 * Token exchange/persistence is intentionally not performed here until the
 * provider's approved token response/storage lifecycle is wired server-side.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");

  if (verifyDistributionOAuthState(state)) {
    const code = url.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(
        new URL("/admin/distribution/provider?connection=failed", url.origin)
      );
    }
    try {
      const token = await exchangeDistributionAuthorizationCode(code);
      await verifyDistributionIdentity(token.access_token);
      // Do not persist or expose the token yet. Persistence is added only with
      // encrypted server-side storage and an explicit refresh-token lifecycle.
      return NextResponse.redirect(
        new URL("/admin/distribution/provider?connection=verified-not-persisted", url.origin)
      );
    } catch {
      return NextResponse.redirect(
        new URL("/admin/distribution/provider?connection=failed", url.origin)
      );
    }
  }

  return completeAuthRedirect(request, "pkce");
}
