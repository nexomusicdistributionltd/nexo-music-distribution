import "server-only";
import { readDistributionOAuthConfig } from "./config";

export async function distributionApiGet<T>(
  path: string,
  accessToken: string
): Promise<T> {
  const cfg = readDistributionOAuthConfig();
  const base = cfg.apiBaseUrl.replace(/\/$/, "");
  const relative = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${base}${relative}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Distribution Engine request failed (HTTP ${response.status}).`);
  }
  return (await response.json()) as T;
}

export function verifyDistributionIdentity(accessToken: string) {
  return distributionApiGet<unknown>("/me", accessToken);
}
