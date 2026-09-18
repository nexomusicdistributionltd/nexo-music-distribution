import { type NextRequest, NextResponse } from "next/server";
import { completeAuthRedirect } from "@/lib/supabase/auth-redirect";
import { verifyDistributionOAuthState } from "@/lib/provider/oauth/state";
import { exchangeDistributionAuthorizationCode } from "@/lib/provider/oauth/token";
import { verifyDistributionIdentity } from "@/lib/provider/oauth/client";
import { saveDistributionToken } from "@/lib/provider/oauth/store";
import { getSiteUrl } from "@/lib/site-url";

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
  const appOrigin = getSiteUrl();
  const state = url.searchParams.get("state");

  const stateCookie = request.cookies.get("nexo_distribution_oauth_state")?.value ?? null;

  const distributionState = verifyDistributionOAuthState(state);
  if (distributionState && stateCookie && stateCookie !== state) {
    const response = NextResponse.redirect(
      new URL("/admin/distribution/provider?connection=failed", appOrigin)
    );
    response.cookies.delete("nexo_distribution_oauth_state");
    return response;
  }

  if (distributionState) {
    const code = url.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(
        new URL("/admin/distribution/provider?connection=failed", appOrigin)
      );
    }
    try {
      const token = await exchangeDistributionAuthorizationCode(code);
      // Persist the valid OAuth token first. Identity verification is a health check and
      // must not prevent a successful authorization from being stored if /me is unavailable.
      await saveDistributionToken(token);
      try {
        await verifyDistributionIdentity(token.access_token);
      } catch {
        // The credential remains securely stored; protected API calls will validate it in use.
      }
      const response = NextResponse.redirect(
        new URL("/admin/distribution/provider?connection=connected", appOrigin)
      );
      response.cookies.delete("nexo_distribution_oauth_state");
      return response;
    } catch {
      const response = NextResponse.redirect(
        new URL("/admin/distribution/provider?connection=failed", appOrigin)
      );
      response.cookies.delete("nexo_distribution_oauth_state");
      return response;
    }
  }

  return completeAuthRedirect(request, "pkce");
}
