import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site-url";
import { DistributionApiHttpError, verifyDistributionIdentity } from "./client";
import { readDistributionOAuthConfig } from "./config";
import { verifyDistributionOAuthState } from "./state";
import {
  DistributionOAuthTokenError,
  exchangeDistributionAuthorizationCode,
} from "./token";
import {
  markDistributionCredentialVerified,
  saveDistributionToken,
} from "./store";

const STATE_COOKIE = "nexo_distribution_oauth_state";
const PKCE_COOKIE = "nexo_distribution_oauth_pkce";

function redirectToProviderStatus(connection: string) {
  return NextResponse.redirect(
    new URL(
      `/admin/distribution/provider?connection=${encodeURIComponent(connection)}`,
      getSiteUrl()
    )
  );
}

function clearDistributionCookies(response: NextResponse) {
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(PKCE_COOKIE);
  return response;
}

export function isDistributionOAuthCallbackRequest(request: NextRequest): boolean {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get(STATE_COOKIE)?.value ?? null;
  return Boolean(
    state?.startsWith("nexo_dist_v1.") &&
      cookieState?.startsWith("nexo_dist_v1.")
  );
}

export async function handleDistributionOAuthCallback(
  request: NextRequest
): Promise<NextResponse> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value ?? null;
  const codeVerifier = request.cookies.get(PKCE_COOKIE)?.value ?? null;

  if (
    !verifyDistributionOAuthState(state) ||
    !stateCookie ||
    stateCookie !== state ||
    !codeVerifier
  ) {
    return clearDistributionCookies(redirectToProviderStatus("failed"));
  }

  const providerError = url.searchParams.get("error");
  if (providerError) {
    const connection = providerError === "invalid_client" ? "invalid_client" : "failed";
    return clearDistributionCookies(redirectToProviderStatus(connection));
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return clearDistributionCookies(redirectToProviderStatus("failed"));
  }

  try {
    const cfg = readDistributionOAuthConfig();
    const token = await exchangeDistributionAuthorizationCode(code, {
      redirectUri: cfg.redirectUri,
      codeVerifier,
    });

    await verifyDistributionIdentity(token.access_token);
    await saveDistributionToken(token);
    await markDistributionCredentialVerified();

    return clearDistributionCookies(redirectToProviderStatus("connected"));
  } catch (error) {
    const connection =
      error instanceof DistributionOAuthTokenError && error.code === "invalid_client"
        ? "invalid_client"
        : error instanceof DistributionApiHttpError && error.status === 403
          ? "forbidden"
          : "verification_failed";
    return clearDistributionCookies(redirectToProviderStatus(connection));
  }
}
