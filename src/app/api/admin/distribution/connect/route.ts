import { NextResponse } from "next/server";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createDistributionAuthorizationUrl } from "@/lib/provider/oauth/authorize";
import { DISTRIBUTION_OAUTH_CALLBACK_PATH, isDistributionOAuthConfigured } from "@/lib/provider/oauth/config";
import { getSiteUrl } from "@/lib/site-url";

export async function GET() {
  await RequireAdministrator();
  const canonicalOrigin = getSiteUrl();
  if (!isDistributionOAuthConfigured()) {
    return NextResponse.json(
      { error: "Distribution Engine OAuth is not configured on the server." },
      { status: 503 }
    );
  }
  const { url, state } = createDistributionAuthorizationUrl();
  // OAuth must always return to the canonical Nexo production domain, never a Netlify deploy-preview host.
  const callbackUrl = `${canonicalOrigin}${DISTRIBUTION_OAUTH_CALLBACK_PATH}`;\n  url.searchParams.set("redirect_uri", callbackUrl);\n  // Force the provider to present a fresh consent/authorization flow on reconnect.\n  url.searchParams.set("prompt", "consent");
  const response = NextResponse.redirect(url);
  response.cookies.set("nexo_distribution_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: DISTRIBUTION_OAUTH_CALLBACK_PATH,
    maxAge: 10 * 60,
  });
  return response;
}
