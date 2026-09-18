import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdministrator } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { ProviderDataTable } from "@/components/admin/ProviderDataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { getProviderConnectionState } from "@/lib/provider";
import { distributionReference, providerRows } from "@/lib/provider/distribution-reference";
import { getDistributionCredentialMetadata } from "@/lib/provider/oauth/store";
import { distributionCapabilityReport, missingDistributionScopes } from "@/lib/provider/capabilities";
import { isDistributionOAuthConfigured, readDistributionOAuthConfig } from "@/lib/provider/oauth/config";

export const metadata: Metadata = {
  title: "TooLost account",
  robots: { index: false, follow: false },
};

function errorMessage(result: PromiseSettledResult<unknown>): string | null {
  if (result.status === "fulfilled") return null;
  return result.reason instanceof Error ? result.reason.message : "Provider request failed.";
}

export default async function DistributionAccountPage() {
  await RequireAdministrator();

  const [provider, credential] = await Promise.all([
    getProviderConnectionState(),
    getDistributionCredentialMetadata(),
  ]);
  const configuredScope = isDistributionOAuthConfigured()
    ? readDistributionOAuthConfig().scope
    : null;
  const reportedScope = credential?.scope ?? null;
  const scopeForReport = reportedScope ?? configuredScope;
  const capabilities = distributionCapabilityReport(scopeForReport);
  const missing = reportedScope ? missingDistributionScopes(reportedScope) : [];

  const [identity, releases, analytics, sales] = await Promise.allSettled([
    distributionReference.me(),
    distributionReference.releases({ page: 1, perPage: 25 }),
    distributionReference.analytics(),
    distributionReference.salesOverview({ page: 1, perPage: 25 }),
  ]);

  return (
    <div>
      <PageHeader
        title="TooLost account"
        description="Live provider account, OAuth capabilities, catalog, analytics and sales access for Nexo administrators."
      />
      <DistributionNav current="/admin/distribution/account" />
      <ProviderBanner connected={provider.connected} />

      {!reportedScope ? (
        <Alert variant="default" title="Provider scope list not reported">
          The token did not report its granted scope list. The live protected endpoint checks below are the authoritative capability test.
        </Alert>
      ) : missing.length ? (
        <Alert variant="warning" title="Provider permissions need attention">
          Missing required scope{missing.length === 1 ? "" : "s"}: {missing.join(", ")}. Reconnect TooLost to request the current Nexo scope set.
        </Alert>
      ) : (
        <Alert variant="success" title="Provider permissions ready">
          The stored authorization reports all Nexo-required TooLost scopes.
        </Alert>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-small">Connection</CardTitle></CardHeader>
          <CardContent><p className="text-h4">{provider.connected ? "Connected" : "Unavailable"}</p><p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{provider.message}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-small">Catalog rows</CardTitle></CardHeader>
          <CardContent><p className="text-h4">{releases.status === "fulfilled" ? providerRows(releases.value).length : "—"}</p><p className="mt-1 text-caption text-[var(--nexo-text-muted)]">First live provider page only.</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-small">Token verified</CardTitle></CardHeader>
          <CardContent><p className="text-small">{credential?.verifiedAt ? new Date(credential.verifiedAt).toLocaleString() : "Not verified"}</p><p className="mt-1 text-caption text-[var(--nexo-text-muted)]">Expiry: {credential?.expiresAt ? new Date(credential.expiresAt).toLocaleString() : "not reported"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-small">Webhook</CardTitle></CardHeader>
          <CardContent><p className="text-h4">{provider.webhookConfigured ? "Ready" : "Missing"}</p><Link href="/admin/distribution/webhooks" className="mt-2 inline-block text-caption underline">Webhook operations</Link></CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="text-h4">OAuth capability matrix</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          {reportedScope ? "Scopes reported by the stored provider token." : "The provider did not report token scopes; showing the configured request set."}
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {capabilities.map((capability) => (
            <div key={capability.key} className="flex items-center justify-between rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-3 py-2 text-small">
              <span>{capability.label}<span className="ml-2 text-caption text-[var(--nexo-text-muted)]">{capability.scope}</span></span>
              <strong>{reportedScope ? (capability.granted ? "READY" : "MISSING") : (capability.granted ? "REQUESTED" : "NOT REQUESTED")}</strong>
            </div>
          ))}
        </div>
        {reportedScope && missing.length ? (
          <Link href="/api/admin/distribution/connect" className="mt-4 inline-flex rounded-md bg-[var(--nexo-accent)] px-4 py-2 text-small font-semibold text-black">
            Reconnect TooLost
          </Link>
        ) : null}
      </section>

      <div className="mt-8 space-y-8">
        <ProviderDataTable
          title="Provider catalog"
          description="Live release rows returned by TooLost."
          payload={releases.status === "fulfilled" ? releases.value : null}
          error={errorMessage(releases)}
        />
        <ProviderDataTable
          title="Provider analytics"
          description="Live analytics response. No generated stream counts."
          payload={analytics.status === "fulfilled" ? analytics.value : null}
          error={errorMessage(analytics)}
        />
        <ProviderDataTable
          title="Sales / royalties"
          description="Live TooLost sales response. Access requires read:sales."
          payload={sales.status === "fulfilled" ? sales.value : null}
          error={errorMessage(sales)}
        />
      </div>

      <details className="mt-8 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-small">
        <summary className="cursor-pointer font-medium">Provider identity response</summary>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-caption text-[var(--nexo-text-muted)]">
          {identity.status === "fulfilled" ? JSON.stringify(identity.value, null, 2) : errorMessage(identity)}
        </pre>
      </details>
    </div>
  );
}
