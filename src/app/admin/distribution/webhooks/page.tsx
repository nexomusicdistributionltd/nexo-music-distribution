import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { getProviderConnectionState } from "@/lib/provider";
import { listWebhookEvents } from "@/lib/distribution/queries";
import { ensureProviderWebhookSigningSecret } from "@/lib/provider/webhook-secret";
import { WebhookSecretManager } from "@/components/distribution/WebhookSecretManager";

export const metadata: Metadata = {
  title: "Webhooks / Events",
  robots: { index: false, follow: false },
};

export default async function WebhooksPage() {
  await RequireAdmin();

  let webhookSetup: {
    configured: boolean;
    source: string;
    created: boolean;
    revealSecret: string | null;
  };

  try {
    webhookSetup = await ensureProviderWebhookSigningSecret();
  } catch {
    webhookSetup = {
      configured: false,
      source: "missing",
      created: false,
      revealSecret: null,
    };
  }

  const [provider, events] = await Promise.all([
    getProviderConnectionState(),
    listWebhookEvents(50),
  ]);

  return (
    <div>
      <PageHeader
        title="Webhooks / Events"
        description="Signed Distribution Engine webhook events are verified, persisted, and processed idempotently."
      />
      <DistributionNav current="/admin/distribution/webhooks" />
      <ProviderBanner connected={provider.connected} />
      <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
        Endpoint: <strong>POST /api/webhooks/provider</strong> · receiver{" "}
        {provider.webhookConfigured ? "ready" : "setup required"}
      </p>

      <WebhookSecretManager
        configured={provider.webhookConfigured || webhookSetup.configured}
        source={webhookSetup.source}
        initialSecret={webhookSetup.created ? webhookSetup.revealSecret : null}
      />

      {events.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No webhook events yet"
            description="The receiver is ready. Use Send signed test event above to verify ingestion; live provider events will appear here after the provider webhook is registered."
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {events.map((e) => (
            <li key={e.id} className="px-4 py-3 text-small">
              <p className="font-medium">
                {e.event_type} · {e.process_status}
              </p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {e.provider_name} · event {e.event_id}
                {e.mapped_status ? ` · mapped ${e.mapped_status}` : ""}
                {e.error_message ? ` · ${e.error_message}` : ""}
                {" · "}
                {new Date(e.received_at).toISOString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
