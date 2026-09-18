import "server-only";

export type DistributionOAuthConfig = {
  apiBaseUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
};

export const DISTRIBUTION_OAUTH_CALLBACK_PATH = "/api/admin/distribution/oauth/callback";
export const LEGACY_DISTRIBUTION_OAUTH_CALLBACK_PATH = "/auth/callback";

function required(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

function resolvedRedirectUri(): string {
  const configured = (process.env.DISTRIBUTION_REDIRECT_URI ?? "").trim();
  const fallback = `https://nexomusicdistribution.com${DISTRIBUTION_OAUTH_CALLBACK_PATH}`;
  if (!configured) return fallback;

  try {
    const url = new URL(configured);
    const allowedPath =
      url.pathname === DISTRIBUTION_OAUTH_CALLBACK_PATH ||
      url.pathname === LEGACY_DISTRIBUTION_OAUTH_CALLBACK_PATH;
    if (
      url.protocol === "https:" &&
      url.hostname === "nexomusicdistribution.com" &&
      allowedPath
    ) {
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    // Fall through to the canonical dedicated callback.
  }

  return fallback;
}

function resolvedScope(): string {
  const configured = (process.env.DISTRIBUTION_OAUTH_SCOPE ?? "")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  // /v1/me requires read:profile. Always include it so connection health can be verified.
  return Array.from(new Set(["read:profile", ...configured])).join(" ");
}

export function readDistributionOAuthConfig(): DistributionOAuthConfig {
  return {
    apiBaseUrl: required("DISTRIBUTION_API_BASE_URL"),
    authorizeUrl: required("DISTRIBUTION_AUTHORIZE_URL"),
    tokenUrl: required("DISTRIBUTION_TOKEN_URL"),
    clientId: required("DISTRIBUTION_CLIENT_ID"),
    clientSecret: required("DISTRIBUTION_CLIENT_SECRET"),
    redirectUri: resolvedRedirectUri(),
    scope: resolvedScope(),
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

export function distributionOAuthPublicInfo(): {
  redirectUri: string;
  requestedScopes: string[];
  authorizationHost: string;
  tokenHost: string;
} {
  const cfg = readDistributionOAuthConfig();
  return {
    redirectUri: cfg.redirectUri,
    requestedScopes: cfg.scope.split(/\s+/).filter(Boolean),
    authorizationHost: new URL(cfg.authorizeUrl).host,
    tokenHost: new URL(cfg.tokenUrl).host,
  };
}
