import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdministrator } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { isDistributionOAuthConfigured, readDistributionOAuthConfig } from "@/lib/provider/oauth/config";
import { hasDistributionCredential, hasDistributionWebhookSecret } from "@/lib/provider/oauth/store";
import { getProviderWebhookSecret } from "@/lib/provider/config";
import { saveProviderWebhookSecretAction, removeProviderWebhookSecretAction } from "./actions";
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
  await RequireAdministrator();
  const query = await searchParams;
  const oauthConfigured = isDistributionOAuthConfigured();
  const authorized = oauthConfigured ? await hasDistributionCredential() : false;
  const health = authorized ? await getStoredDistributionIdentityHealth() : null;
  const connected = Boolean(health?.ok);
  const callbackUri = oauthConfigured ? readDistributionOAuthConfig().redirectUri : null;
  const webhookConfigured = Boolean(getProviderWebhookSecret()) || (await hasDistributionWebhookSecret());

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
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Webhook security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-small">
          <div>
            <p>
              Status: <strong>{webhookConfigured ? "Configured" : "Missing — webhooks fail closed"}</strong>
            </p>
            <p className="mt-1 text-[var(--nexo-text-muted)]">
              Paste the webhook signing secret issued/configured for the provider. It is encrypted before storage and is never returned to the browser.
            </p>
          </div>
          <form action={saveProviderWebhookSecretAction} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              name="webhook_secret"
              minLength={16}
              required
              autoComplete="new-password"
              placeholder={webhookConfigured ? "Replace webhook signing secret" : "Webhook signing secret"}
              className="h-10 flex-1 rounded-md border border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-3"
            />
            <button
              type="submit"
              className="h-10 rounded-md bg-[var(--nexo-accent)] px-4 font-semibold text-black"
            >
              {webhookConfigured ? "Replace secret" : "Save secret"}
            </button>
          </form>
          {webhookConfigured ? (
            <form action={removeProviderWebhookSecretAction}>
              <button type="submit" className="text-caption underline underline-offset-4">
                Remove stored webhook secret
              </button>
            </form>
          ) : null}
          <p className="text-caption text-[var(--nexo-text-muted)]">
            Nexo continues to reject unsigned or invalidly signed webhook payloads.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
