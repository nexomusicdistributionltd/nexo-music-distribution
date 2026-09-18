import "server-only";
import { readDistributionOAuthConfig } from "./config";

export type DistributionOAuthToken = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  [key: string]: unknown;
};

function normalizeTokenPayload(payload: unknown): DistributionOAuthToken {
  if (!payload || typeof payload !== "object") {
    throw new Error("Distribution authorization returned an invalid token response.");
  }
  const body = payload as Record<string, unknown>;
  const accessToken =
    typeof body.access_token === "string"
      ? body.access_token
      : typeof body.accessToken === "string"
        ? body.accessToken
        : null;
  if (!accessToken) {
    throw new Error("Distribution authorization response did not include an access token.");
  }
  const token: DistributionOAuthToken = { access_token: accessToken };
  const refreshToken =
    typeof body.refresh_token === "string"
      ? body.refresh_token
      : typeof body.refreshToken === "string"
        ? body.refreshToken
        : undefined;
  const tokenType =
    typeof body.token_type === "string"
      ? body.token_type
      : typeof body.tokenType === "string"
        ? body.tokenType
        : undefined;
  const expiresIn =
    typeof body.expires_in === "number"
      ? body.expires_in
      : typeof body.expiresIn === "number"
        ? body.expiresIn
        : undefined;

  if (refreshToken) token.refresh_token = refreshToken;
  if (tokenType) token.token_type = tokenType;
  if (expiresIn) token.expires_in = expiresIn;
  if (typeof body.scope === "string") token.scope = body.scope;
  return token;
}

async function tokenRequest(body: URLSearchParams): Promise<Response> {
  const cfg = readDistributionOAuthConfig();
  // Too Lost's public SDK sends confidential client credentials in the form body.
  let response = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  // Compatibility fallback for OAuth servers configured for HTTP Basic client auth.
  if (response.status === 400 || response.status === 401) {
    const retryBody = new URLSearchParams(body);
    retryBody.delete("client_secret");
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
    response = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: retryBody,
      cache: "no-store",
    });
  }
  return response;
}

export async function exchangeDistributionAuthorizationCode(
  code: string,
  redirectUriOverride?: string,
  codeVerifier?: string
): Promise<DistributionOAuthToken> {
  const cfg = readDistributionOAuthConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUriOverride ?? cfg.redirectUri,
  });
  if (codeVerifier) body.set("code_verifier", codeVerifier);

  const response = await tokenRequest(body);
  if (!response.ok) {
    throw new Error(`Distribution authorization failed (HTTP ${response.status}).`);
  }
  return normalizeTokenPayload(await response.json());
}

export async function refreshDistributionAccessToken(
  refreshToken: string
): Promise<DistributionOAuthToken> {
  const cfg = readDistributionOAuthConfig();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const response = await tokenRequest(body);
  if (!response.ok) {
    throw new Error(`Distribution token refresh failed (HTTP ${response.status}).`);
  }
  const token = normalizeTokenPayload(await response.json());
  if (!token.refresh_token) token.refresh_token = refreshToken;
  return token;
}
