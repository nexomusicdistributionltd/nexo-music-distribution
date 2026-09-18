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
export const LEGACY_DISTRIBUTION_OAUTH_CALLBACK_PATH = "/auth/callback";

const DEFAULT_SCOPE = [
  "read:profile",
  "read:releases",
  "write:releases",
  "read:catalog",
  "read:analytics",
  "read:earnings",
  "read:preferences",
  "write:preferences",
].join(" ");

function required(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

function distributionRedirectUri(): string {
  const raw =
    (process.env.DISTRIBUTION_REDIRECT_URI ?? "").trim() ||
    `https://nexomusicdistribution.com${DISTRIBUTION_OAUTH_CALLBACK_PATH}`;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("DISTRIBUTION_REDIRECT_URI must be a valid absolute URL.");
  }
  if (parsed.origin !== "https://nexomusicdistribution.com") {
    throw new Error("Distribution OAuth redirect must use the canonical Nexo production origin.");
  }
  if (
    parsed.pathname !== DISTRIBUTION_OAUTH_CALLBACK_PATH &&
    parsed.pathname !== LEGACY_DISTRIBUTION_OAUTH_CALLBACK_PATH
  ) {
    throw new Error("Distribution OAuth redirect path is not supported.");
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function readDistributionOAuthConfig(): DistributionOAuthConfig {
  return {
    apiBaseUrl: required("DISTRIBUTION_API_BASE_URL"),
    authorizeUrl: required("DISTRIBUTION_AUTHORIZE_URL"),
    tokenUrl: required("DISTRIBUTION_TOKEN_URL"),
    clientId: required("DISTRIBUTION_CLIENT_ID"),
    clientSecret: required("DISTRIBUTION_CLIENT_SECRET"),
    redirectUri: distributionRedirectUri(),
    scope: (process.env.DISTRIBUTION_OAUTH_SCOPE ?? "").trim() || DEFAULT_SCOPE,
  };
}

export function isDistributionOAuthConfigured(): boolean {
  return [
    "DISTRIBUTION_API_BASE_URL",
    "DISTRIBUTION_AUTHORIZE_URL",
    "DISTRIBUTION_TOKEN_URL",
    "DISTRIBUTION_CLIENT_ID",
    "DISTRIBUTION_CLIENT_SECRET",
    "DISTRIBUTION_OAUTH_STATE_SECRET",
    "DISTRIBUTION_TOKEN_ENCRYPTION_KEY",
  ].every((key) => Boolean((process.env[key] ?? "").trim()));
}
