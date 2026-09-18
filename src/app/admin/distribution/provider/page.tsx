import type { Metadata } from "next";
import { RequireAdministrator } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { isDistributionOAuthConfigured } from "@/lib/provider/oauth/config";
import { hasDistributionCredential } from "@/lib/provider/oauth/store";

export const metadata: Metadata = {
  title: "Provider status",
  robots: { index: false, follow: false },
};

export default async function ProviderStatusPage() {
  await RequireAdministrator();
  const oauthConfigured = isDistributionOAuthConfigured();
  const authorized = oauthConfigured ? await hasDistributionCredential() : false;

  return (
    <div>
      <PageHeader title="Provider status" description="Server-side configuration only. Secrets never shown." />
      <DistributionNav current="/admin/distribution/provider" />
      <ProviderBanner connected={authorized} />
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-small">
          <p>Status: <strong>{authorized ? "Connected" : oauthConfigured ? "Ready to connect" : "Configuration incomplete"}</strong></p>
          <p>OAuth configuration: {oauthConfigured ? "ready" : "incomplete"}</p>
          <p className="text-[var(--nexo-text-muted)]">{authorized ? "Distribution Engine authorization is stored securely." : "Connect the Distribution Engine to authorize delivery and data access."}</p>
          {oauthConfigured && !authorized ? (
            <a
              href="/api/admin/distribution/connect"
              className="inline-flex rounded-md bg-[var(--nexo-accent)] px-4 py-2 font-semibold text-black"
            >
              Connect Distribution Engine
            </a>
          ) : null}
          {!authorized ? (
            <p className="text-[var(--nexo-text-muted)]">
              Complete the secure Distribution Engine connection before using submit, sync, or delivery actions.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
