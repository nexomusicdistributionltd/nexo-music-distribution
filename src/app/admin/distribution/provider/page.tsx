import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdministrator } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { isDistributionOAuthConfigured, readDistributionOAuthConfig } from "@/lib/provider/oauth/config";
import { hasDistributionCredential } from "@/lib/provider/oauth/store";
import { getStoredDistributionIdentityHealth } from "@/lib/provider/oauth/client";

export const metadata: Metadata = {
  title: "Provider status",
  robots: { index: false, follow: false },
};

export default async function ProviderStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  const ctx = await RequireAdministrator();
  const query = await searchParams;
  const oauthConfigured = isDistributionOAuthConfigured();
  const authorized = oauthConfigured ? await hasDistributionCredential() : false;
  const health = authorized ? await getStoredDistributionIdentityHealth() : null;
  const connected = Boolean(health?.ok);
  const callbackUri = oauthConfigured ? readDistributionOAuthConfig().redirectUri : null;

  return (
    <div>
      <PageHeader
        title="Provider status"
        description="Server-side configuration only. Secrets never shown."
      />
      <DistributionNav current="/admin/distribution/provider" />
      <ProviderBanner connected={connected} />
      {query.connection === "invalid_client" ? (
        <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-small">
          The Distribution Engine rejected this OAuth client. Confirm that the developer app is active
          and that its registered callback URI exactly matches the callback shown below, then reconnect.
        </div>
      ) : null}
      {query.connection === "forbidden" ? (
        <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-small">
          Authorization returned, but the provider denied protected API access (HTTP 403). The
          connection is not active.
        </div>
      ) : null}
      {query.connection === "failed" || query.connection === "verification_failed" ? (
        <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-small">
          Provider authorization did not complete. Use Reconnect Distribution Engine to start a
          fresh authorization.
        </div>
      ) : null}
      {ctx.roles.includes("super_admin") ? (
        <Card className="mt-4">
          <CardHeader><CardTitle>API response checks</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-small">
            <p>Download a report of response types using the existing connection. Reports exclude customer values and tokens. Each check makes up to four read requests that count toward your provider quota.</p>
            <p>These checks help verify integrations when documentation is unavailable. Empty responses cannot establish the missing schema.</p>
            <form method="post" action="/api/admin/distribution/inspect" className="flex flex-wrap gap-3">
              {["analytics", "sales", "preferences", "lookups"].map(group => (
                <button key={group} type="submit" name="group" value={group} disabled={!authorized}
                  className="rounded-md border border-[var(--nexo-border)] px-4 py-2 capitalize disabled:opacity-50">
                  Check {group}
                </button>
              ))}
            </form>
          </CardContent>
        </Card>
      ) : null}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-small">
          <p>
            Status:{" "}
            <strong>
              {connected
                ? "Connected"
                : authorized
                  ? "Authorization stored — API access not verified"
                  : oauthConfigured
                    ? "Ready to connect"
                    : "Configuration incomplete"}
            </strong>
          </p>
          <p>OAuth configuration: {oauthConfigured ? "ready" : "incomplete"}</p>
          {callbackUri ? (
            <p className="break-all text-[var(--nexo-text-muted)]">
              Registered callback URI: <code>{callbackUri}</code>
            </p>
          ) : null}
          <p className="text-[var(--nexo-text-muted)]">
            {connected
              ? "Distribution Engine authorization and protected API access are verified."
              : health?.message ??
                (authorized
                  ? "Authorization is stored securely, but protected API access has not been verified."
                  : "Connect the Distribution Engine to authorize delivery and data access.")}
          </p>
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
              Complete the secure Distribution Engine connection before using submit, sync, or
              delivery actions.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
