import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { readDistributionOAuthConfig } from "./config";
import { createDistributionOAuthState } from "./state";

function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(64).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest()
    .toString("base64url");
  return { codeVerifier, codeChallenge };
}

export function createDistributionAuthorizationUrl(): {
  url: URL;
  state: string;
  codeVerifier: string;
} {
  const cfg = readDistributionOAuthConfig();
  const state = createDistributionOAuthState();
  const { codeVerifier, codeChallenge } = createPkcePair();
  const url = new URL(cfg.authorizeUrl);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return { url, state, codeVerifier };
}
