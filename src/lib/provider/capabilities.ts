import "server-only";

export const DISTRIBUTION_CAPABILITIES = [
  { key: "profile", label: "Account profile", scope: "read:profile" },
  { key: "releases_read", label: "Read catalog releases", scope: "read:releases" },
  { key: "releases_write", label: "Create and update releases", scope: "write:releases" },
  { key: "catalog", label: "Catalog access", scope: "read:catalog" },
  { key: "analytics", label: "Analytics", scope: "read:analytics" },
  { key: "sales", label: "Sales and royalty reporting", scope: "read:sales" },
  { key: "preferences_read", label: "Read preferences", scope: "read:preferences" },
  { key: "preferences_write", label: "Update preferences", scope: "write:preferences" },
] as const;

export type DistributionCapability = (typeof DISTRIBUTION_CAPABILITIES)[number];

export function parseDistributionScopes(scope: string | null | undefined): Set<string> {
  return new Set(
    (scope ?? "")
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function distributionCapabilityReport(scope: string | null | undefined) {
  const scopes = parseDistributionScopes(scope);
  return DISTRIBUTION_CAPABILITIES.map((capability) => ({
    ...capability,
    granted: scopes.has(capability.scope),
  }));
}

export function missingDistributionScopes(scope: string | null | undefined): string[] {
  return distributionCapabilityReport(scope)
    .filter((capability) => !capability.granted)
    .map((capability) => capability.scope);
}
