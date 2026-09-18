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
  // Only request scopes explicitly approved/configured for this provider app.
  // Never guess provider-specific scope names.
  if (cfg.scope) url.searchParams.set("scope", cfg.scope);
  return { url, state };
}
