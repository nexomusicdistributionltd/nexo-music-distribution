import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { readDistributionOAuthConfig } from "./config";
import { createDistributionOAuthState } from "./state";

export function createDistributionAuthorizationUrl(): {
  url: URL;
  state: string;
  codeVerifier: string;
} {
  const cfg = readDistributionOAuthConfig();
  const state = createDistributionOAuthState();
  const codeVerifier = randomBytes(64).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (cfg.scope) url.searchParams.set("scope", cfg.scope);

  return { url, state, codeVerifier };
}
