import type { Metadata } from "next";
import { RequireAdministrator } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getProviderConnectionState } from "@/lib/provider";
import { isDistributionOAuthConfigured } from "@/lib/provider/oauth/config";

export const metadata: Metadata = {
  title: "Provider status",
  robots: { index: false, follow: false },
};

export default async function ProviderStatusPage() {
  await RequireAdministrator();
  const state = getProviderConnectionState();
  const oauthConfigured = isDistributionOAuthConfigured();

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
          <p>OAuth configuration: {oauthConfigured ? "ready" : "incomplete"}</p>
          <p className="text-[var(--nexo-text-muted)]">{state.message}</p>
          {oauthConfigured ? (
            <a
              href="/api/admin/distribution/connect"
              className="inline-flex rounded-md bg-[var(--nexo-accent)] px-4 py-2 font-semibold text-black"
            >
              Connect Distribution Engine
            </a>
          ) : null}
          {!state.connected ? (
            <p className="text-[var(--nexo-text-muted)]">
              Complete the secure Distribution Engine connection before using submit, sync, or delivery actions.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
