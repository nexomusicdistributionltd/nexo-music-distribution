import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { WebhookRuntimePanel } from "@/components/distribution/WebhookRuntimePanel";
import { getProviderConnectionState } from "@/lib/provider";
import { listWebhookEvents } from "@/lib/distribution/queries";
import { ensureRuntimeProviderWebhookSecret } from "@/lib/provider/webhook-secret";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Webhooks / Events",
  robots: { index: false, follow: false },
};

export default async function WebhooksPage() {
  const ctx = await RequireAdminPermission("admin:distribution");

  let secretSource: "environment" | "database" | "none" = "none";
  try {
    const runtime = await ensureRuntimeProviderWebhookSecret(ctx.userId);
    secretSource = runtime.source;
  } catch {
    // The page remains available for diagnostics; the runtime panel will show setup required.
  }

  const [provider, events] = await Promise.all([
    getProviderConnectionState(),
    listWebhookEvents(50),
  ]);

  const endpoint = `${getSiteUrl()}/api/webhooks/provider`;

  return (
    <div>
      <PageHeader
        title="Webhooks / Events"
        description="Signed Distribution Engine events are verified, stored idempotently, and reflected here in realtime."
      />
      <DistributionNav current="/admin/distribution/webhooks" />
      <ProviderBanner connected={provider.connected} />

      <WebhookRuntimePanel
        endpoint={endpoint}
        configured={provider.webhookConfigured}
        source={provider.webhookConfigured ? secretSource : "none"}
        canManageSecret={ctx.roles.includes("super_admin")}
      />

      <div className="mt-4">
        {events.length === 0 ? (
          <EmptyState
            title="Waiting for the first provider event"
            description={
              provider.webhookConfigured
                ? "Nexo webhook signing is configured. Signed inbound provider events will appear here automatically."
                : "Webhook signing could not be provisioned. Use the runtime controls above after server configuration is available."
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
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
    </div>
  );
}
