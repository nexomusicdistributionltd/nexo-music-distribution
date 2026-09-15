import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { createClient } from "@/lib/supabase/server";
import {
  EmailEventsTable,
  type EmailEventListItem,
} from "@/components/admin/EmailEventsTable";
import { Alert } from "@/components/ui/Alert";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { getEmailProviderStatus } from "@/lib/email/provider";

export const metadata: Metadata = {
  title: "Admin emails",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  // Prefer admin:emails; fall back allowed via nav for admin:notifications holders who also have emails in STAFF_BASE
  const ctx = await RequireAdminPermission("admin:emails");
  if (
    !hasAdminPermission(ctx.roles, "admin:emails") &&
    !hasAdminPermission(ctx.roles, "admin:notifications")
  ) {
    // RequireAdminPermission already redirects; this is defensive
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_events")
    .select(
      "id, event_type, template_key, recipient_email, recipient_user_id, related_release_id, status, provider, provider_message_id, error, created_at, sent_at, attempt_count"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const events = (data ?? []) as EmailEventListItem[];
  const provider = getEmailProviderStatus();

  return (
    <div>
      <PageHeader
        title="Email outbox"
        description="Transactional and manual email events. Use Templates to edit branded HTML and Send to enqueue to selected users or everyone. Status SENT is only set after a real provider accept — never fabricated. Retry creates a new event with a new idempotency key."
      />
      <Alert
        variant={provider.configured ? "success" : "warning"}
        title="Provider"
        className="mb-4"
      >
        {provider.message}{" "}
        <Link className="underline-offset-4 hover:underline" href="/admin/emails/templates">
          Templates
        </Link>
        {" · "}
        <Link className="underline-offset-4 hover:underline" href="/admin/emails/send">
          Send
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
