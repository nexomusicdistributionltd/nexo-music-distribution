import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { EmailEventsTable } from "@/components/admin/EmailEventsTable";
import { Alert } from "@/components/ui/Alert";
import { outboundToListItem, type OutboundEventRow } from "@/lib/email/outbound-meta";
import { getEmailProviderStatus } from "@/lib/email/provider";
import { ProcessOutboxButton } from "@/components/admin/ProcessOutboxButton";

export const metadata: Metadata = {
  title: "Email activity",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminEmailsActivityPage() {
  await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_outbound_events")
    .select(
      "id, to_email, template_key, payload, status, provider, provider_message_id, error, related_entity_type, related_entity_id, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(150);

  const events = ((data ?? []) as OutboundEventRow[]).map(outboundToListItem);
  const provider = getEmailProviderStatus();
  const queued = events.filter((e) => e.status === "queued").length;
  const sent = events.filter((e) => e.status === "sent").length;
  const failed = events.filter((e) => e.status === "failed").length;

  return (
    <div>
      <PageHeader
        title="Email activity"
        description="Canonical outbox log. Statuses are queued, skipped, failed, or sent after a real Zoho SMTP accept. Nothing here is invented from page views."
        actions={<ProcessOutboxButton />}
      />
      <Alert variant={provider.configured ? "success" : "warning"} title="Provider" className="mb-4">
        {provider.message} This page: {sent} sent · {queued} queued · {failed} failed (latest {events.length}).
      </Alert>
      {error ? (
        <p className="text-small text-red-400">Failed to load: {error.message}</p>
      ) : (
        <EmailEventsTable events={events} />
      )}
    </div>
  );
}
