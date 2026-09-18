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

export class DistributionOAuthTokenError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null
  ) {
    super(code ? `Distribution authorization failed (${code}).` : `Distribution authorization failed (HTTP ${status}).`);
    this.name = "DistributionOAuthTokenError";
  }
}

async function readTokenError(response: Response): Promise<DistributionOAuthTokenError> {
  let code: string | null = null;
  try {
    const payload = (await response.clone().json()) as Record<string, unknown>;
    if (typeof payload.error === "string") code = payload.error;
  } catch {
    // Keep provider response details private.
  }
  return new DistributionOAuthTokenError(response.status, code);
}

/**
 * OAuth authorization-code exchange.
 *
 * Too Lost's current OAuth client behavior posts the confidential-client
 * credentials in the application/x-www-form-urlencoded body and supports PKCE.
 * The fallback Basic request is retained only for OAuth-server compatibility.
 */
export async function exchangeDistributionAuthorizationCode(
  code: string,
  options?: {
    redirectUri?: string;
    codeVerifier?: string;
  }
): Promise<DistributionOAuthToken> {
  const cfg = readDistributionOAuthConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: options?.redirectUri ?? cfg.redirectUri,
  });
  if (options?.codeVerifier) body.set("code_verifier", options.codeVerifier);

  let response = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  // Compatibility fallback for OAuth servers configured for client_secret_basic.
  if (response.status === 400 || response.status === 401) {
    let codeValue: string | null = null;
    try {
      const payload = (await response.clone().json()) as Record<string, unknown>;
      codeValue = typeof payload.error === "string" ? payload.error : null;
    } catch {
      // Ignore unparsable provider body.
    }
    if (codeValue === "invalid_client") {
      const retryBody = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: options?.redirectUri ?? cfg.redirectUri,
      });
      if (options?.codeVerifier) retryBody.set("code_verifier", options.codeVerifier);
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
  }

  if (!response.ok) throw await readTokenError(response);

  const data = (await response.json()) as DistributionOAuthToken;
  if (!data.access_token || typeof data.access_token !== "string") {
    throw new Error("Distribution authorization response did not include an access token.");
  }
  return data;
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
  const response = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw await readTokenError(response);

  const data = (await response.json()) as DistributionOAuthToken;
  if (!data.access_token || typeof data.access_token !== "string") {
    throw new Error("Distribution token refresh did not return an access token.");
  }
  if (!data.refresh_token) data.refresh_token = refreshToken;
  return data;
}
