import { NextResponse } from "next/server";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createDistributionAuthorizationUrl } from "@/lib/provider/oauth/authorize";
import { isDistributionOAuthConfigured } from "@/lib/provider/oauth/config";

export async function GET() {
  await RequireAdministrator();

  if (!isDistributionOAuthConfigured()) {
    return NextResponse.json(
      { error: "Distribution Engine OAuth is not configured on the server." },
      { status: 503 }
    );
  }

  const { url, state, codeVerifier } = createDistributionAuthorizationUrl();
  const response = NextResponse.redirect(url);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };

  response.cookies.set("nexo_distribution_oauth_state", state, cookieOptions);
  response.cookies.set("nexo_distribution_oauth_pkce", codeVerifier, cookieOptions);
  return response;
}
