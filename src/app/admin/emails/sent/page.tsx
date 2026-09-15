import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { EmailEventsTable } from "@/components/admin/EmailEventsTable";
import { Alert } from "@/components/ui/Alert";
import { outboundToListItem, type OutboundEventRow } from "@/lib/email/outbound-meta";
import { getEmailProviderStatus } from "@/lib/email/provider";

export const metadata: Metadata = {
  title: "Sent email",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminEmailsSentPage() {
  await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_outbound_events")
    .select(
      "id, to_email, template_key, payload, status, provider, provider_message_id, error, related_entity_type, related_entity_id, created_at, updated_at"
    )
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(100);

  const events = ((data ?? []) as OutboundEventRow[]).map(outboundToListItem);
  const provider = getEmailProviderStatus();

  return (
    <div>
      <PageHeader
        title="Sent / history"
        description="Canonical sent rows from email_outbound_events. SENT requires zoho-smtp + provider_message_id. Queued and failed mail live on Activity / Failed."
      />
      <Alert variant={provider.configured ? "success" : "warning"} title="Provider" className="mb-4">
        {provider.message}{" "}
        <Link className="underline-offset-4 hover:underline" href="/admin/emails/compose">
          Compose
        </Link>
      </Alert>
      {error ? (
        <p className="text-small text-red-400">Failed to load: {error.message}</p>
      ) : (
        <EmailEventsTable events={events} />
      )}
    </div>
  );
}
