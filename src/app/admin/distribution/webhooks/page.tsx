import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { getProviderConnectionState } from "@/lib/provider";
import { listWebhookEvents } from "@/lib/distribution/queries";
import { getProviderWebhookRuntimeSettings } from "@/lib/provider/webhook-settings";
import { WebhookSettingsForm } from "@/components/distribution/WebhookSettingsForm";

export const metadata: Metadata = {
  title: "Webhooks / Events",
  robots: { index: false, follow: false },
};

export default async function WebhooksPage() {
  await RequireAdmin();
  const [provider, webhookSettings, events] = await Promise.all([
    getProviderConnectionState(),
    getProviderWebhookRuntimeSettings(),
    listWebhookEvents(50),
  ]);

  return (
    <div>
      <PageHeader
        title="Webhooks / Events"
        description="Secure provider event ingress, signing verification and idempotent delivery-event history."
      />
      <DistributionNav current="/admin/distribution/webhooks" />
      <ProviderBanner connected={provider.connected} />
      <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
        Endpoint: <span className="font-mono">POST /api/webhooks/provider</span> · signing{" "}
        {provider.webhookConfigured ? "configured" : "awaiting provider-issued secret"}
      </p>
      <div className="mt-4">
        <WebhookSettingsForm
          configured={webhookSettings.configured}
          enabled={webhookSettings.enabled}
          signatureHeader={webhookSettings.signatureHeader}
          source={webhookSettings.source}
        />
      </div>
      {events.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No webhook events" description="Inbound provider events will list here." />
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
