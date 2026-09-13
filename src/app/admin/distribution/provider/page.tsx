import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getProviderConnectionState, readProviderConfig } from "@/lib/provider";

export const metadata: Metadata = {
  title: "Provider status",
  robots: { index: false, follow: false },
};

export default async function ProviderStatusPage() {
  await RequireAdmin();
  const state = getProviderConnectionState();
  const cfg = readProviderConfig();

  return (
    <div>
      <PageHeader title="Provider status" description="Server-side configuration only. Secrets never shown." />
      <DistributionNav current="/admin/distribution/provider" />
      <ProviderBanner connected={state.connected} />
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-small">
          <p>Status: <strong>{state.connected ? "Connected" : "Not connected / Unavailable"}</strong></p>
          <p>Configured name: {cfg.name}</p>
          <p>API key present: {cfg.apiKeyPresent ? "yes" : "no"}</p>
          <p>API base URL set: {cfg.apiBaseUrl ? "yes" : "no"}</p>
          <p>Webhook secret present: {cfg.webhookSecretPresent ? "yes" : "no"}</p>
          <p className="text-[var(--nexo-text-muted)]">{state.message}</p>
          {!state.connected ? (
            <p className="text-[var(--nexo-text-muted)]">
              Set PROVIDER_NAME + PROVIDER_API_KEY (server-only) and register a real adapter.
              Until then every submit/sync/delivery action returns Provider Not Connected.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
