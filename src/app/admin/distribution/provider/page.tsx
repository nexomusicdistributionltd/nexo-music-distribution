import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdministrator } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { isDistributionOAuthConfigured } from "@/lib/provider/oauth/config";
import { hasDistributionCredential } from "@/lib/provider/oauth/store";
import { getStoredDistributionIdentityHealth } from "@/lib/provider/oauth/client";

export const metadata: Metadata = {
  title: "Provider status",
  robots: { index: false, follow: false },
};

export default async function ProviderStatusPage() {
  await RequireAdministrator();
  const oauthConfigured = isDistributionOAuthConfigured();
  const authorized = oauthConfigured ? await hasDistributionCredential() : false;
  const health = authorized ? await getStoredDistributionIdentityHealth() : null;
  const connected = Boolean(health?.ok);

  return (
    <div>
      <PageHeader title="Provider status" description="Server-side configuration only. Secrets never shown." />
      <DistributionNav current="/admin/distribution/provider" />
      <ProviderBanner connected={connected} />
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-small">
          <p>Status: <strong>{connected ? "Connected" : authorized ? "Authorization stored — API access not verified" : oauthConfigured ? "Ready to connect" : "Configuration incomplete"}</strong></p>
          <p>OAuth configuration: {oauthConfigured ? "ready" : "incomplete"}</p>
          <p className="text-[var(--nexo-text-muted)]">{connected ? "Distribution Engine authorization and protected API access are verified." : health?.message ?? (authorized ? "Authorization is stored securely, but protected API access has not been verified." : "Connect the Distribution Engine to authorize delivery and data access.")}</p>
          {oauthConfigured && !connected ? (
            <Link
              href="/api/admin/distribution/connect"
              className="inline-flex rounded-md bg-[var(--nexo-accent)] px-4 py-2 font-semibold text-black"
            >
              {authorized ? "Reconnect Distribution Engine" : "Connect Distribution Engine"}
            </Link>
          ) : null}
          {!connected ? (
            <p className="text-[var(--nexo-text-muted)]">
              Complete the secure Distribution Engine connection before using submit, sync, or delivery actions.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
