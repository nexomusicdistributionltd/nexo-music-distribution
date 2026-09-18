import { type NextRequest, NextResponse } from "next/server";
import { completeAuthRedirect } from "@/lib/supabase/auth-redirect";
import { verifyDistributionOAuthState } from "@/lib/provider/oauth/state";

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
    // Fail closed rather than risk exposing/storing a token incorrectly.
    // The authorization start route is added separately once admin-only
    // connection ownership and encrypted token persistence are confirmed.
    return NextResponse.redirect(
      new URL("/admin/distribution/provider?connection=pending-token-exchange", url.origin)
    );
  }

  return completeAuthRedirect(request, "pkce");
}
