import { type NextRequest, NextResponse } from "next/server";
import { DISTRIBUTION_OAUTH_CALLBACK_PATH } from "@/lib/provider/oauth/config";
import { verifyDistributionOAuthState } from "@/lib/provider/oauth/state";
import { exchangeDistributionAuthorizationCode } from "@/lib/provider/oauth/token";
import { DistributionApiHttpError, verifyDistributionIdentity } from "@/lib/provider/oauth/client";
import { saveDistributionToken } from "@/lib/provider/oauth/store";
import { getSiteUrl } from "@/lib/site-url";

function redirectToProviderStatus(connection: string) {
  return NextResponse.redirect(
    new URL(`/admin/distribution/provider?connection=${encodeURIComponent(connection)}`, getSiteUrl())
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const stateCookie = request.cookies.get("nexo_distribution_oauth_state")?.value ?? null;

  if (!verifyDistributionOAuthState(state) || !stateCookie || stateCookie !== state) {
    const response = redirectToProviderStatus("failed");
    response.cookies.delete("nexo_distribution_oauth_state");
    return response;
  }

  const providerError = url.searchParams.get("error");
  if (providerError) {
    const response = redirectToProviderStatus("failed");
    response.cookies.delete("nexo_distribution_oauth_state");
    return response;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    const response = redirectToProviderStatus("failed");
    response.cookies.delete("nexo_distribution_oauth_state");
    return response;
  }

  try {
    const callbackUrl = `${getSiteUrl()}${DISTRIBUTION_OAUTH_CALLBACK_PATH}`;
    const token = await exchangeDistributionAuthorizationCode(code, callbackUrl);

    // Persist the newly authorized token, then prove it can access a protected endpoint.
    await saveDistributionToken(token);
    await verifyDistributionIdentity(token.access_token);

    const response = redirectToProviderStatus("connected");
    response.cookies.delete("nexo_distribution_oauth_state");
    return response;
  } catch (error) {
    const connection =
      error instanceof DistributionApiHttpError && error.status === 403
        ? "forbidden"
        : "verification_failed";
    const response = redirectToProviderStatus(connection);
    response.cookies.delete("nexo_distribution_oauth_state");
    return response;
  }
}
