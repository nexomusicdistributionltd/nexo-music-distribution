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

/**
 * OAuth authorization-code exchange.
 * Uses standard OAuth form fields and HTTP Basic client authentication.
 * No token is ever returned to browser code or logged here.
 */
export async function exchangeDistributionAuthorizationCode(
  code: string
): Promise<DistributionOAuthToken> {
  const cfg = readDistributionOAuthConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
  });
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  let response = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
    cache: "no-store",
  });

  // Some OAuth servers expect confidential-client credentials in the form body.
  // Retry only an authentication-style failure; never log either credential.
  if (response.status === 400 || response.status === 401) {
    body.set("client_id", cfg.clientId);
    body.set("client_secret", cfg.clientSecret);
    response = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });
  }
  if (!response.ok) {
    throw new Error(`Distribution authorization failed (HTTP ${response.status}).`);
  }
  const data = (await response.json()) as DistributionOAuthToken;
  if (!data.access_token || typeof data.access_token !== "string") {
    throw new Error("Distribution authorization response did not include an access token.");
  }
  return data;
}
