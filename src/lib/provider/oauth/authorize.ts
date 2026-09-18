import "server-only";
import { readDistributionOAuthConfig } from "./config";
import { createDistributionOAuthState } from "./state";

export function createDistributionAuthorizationUrl(): { url: URL; state: string } {
  const cfg = readDistributionOAuthConfig();
  const state = createDistributionOAuthState();
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("state", state);
  // Scope is intentionally omitted until the provider documents/assigns approved scopes.
  return { url, state };
}
