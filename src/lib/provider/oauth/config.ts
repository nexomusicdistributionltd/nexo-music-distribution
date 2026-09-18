import "server-only";

export type DistributionOAuthConfig = {
  apiBaseUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string | null;
};

export const DISTRIBUTION_OAUTH_CALLBACK_PATH = "/api/admin/distribution/oauth/callback";

function required(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

export function readDistributionOAuthConfig(): DistributionOAuthConfig {
  return {
    apiBaseUrl: required("DISTRIBUTION_API_BASE_URL"),
    authorizeUrl: required("DISTRIBUTION_AUTHORIZE_URL"),
    tokenUrl: required("DISTRIBUTION_TOKEN_URL"),
    clientId: required("DISTRIBUTION_CLIENT_ID"),
    clientSecret: required("DISTRIBUTION_CLIENT_SECRET"),
    redirectUri: required("DISTRIBUTION_REDIRECT_URI"),
    scope: (process.env.DISTRIBUTION_OAUTH_SCOPE ?? "").trim() || null,
  };
}

export function isDistributionOAuthConfigured(): boolean {
  return [
    "DISTRIBUTION_API_BASE_URL",
    "DISTRIBUTION_AUTHORIZE_URL",
    "DISTRIBUTION_TOKEN_URL",
    "DISTRIBUTION_CLIENT_ID",
    "DISTRIBUTION_CLIENT_SECRET",
    "DISTRIBUTION_REDIRECT_URI",
    "DISTRIBUTION_OAUTH_STATE_SECRET",
    "DISTRIBUTION_TOKEN_ENCRYPTION_KEY",
  ].every((key) => Boolean((process.env[key] ?? "").trim()));
}
