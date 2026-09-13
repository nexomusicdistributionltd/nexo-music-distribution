import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { TicketPanel } from "@/components/admin/TicketPanel";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  await RequireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);

  const selectedId = sp.ticket || tickets?.[0]?.id;
  let messages: unknown[] = [];
  if (selectedId) {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", selectedId)
      .order("created_at", { ascending: true })
      .limit(200);
    messages = data ?? [];
  }

  return (
    <div>
      <PageHeader
        title="Support tickets"
        description="Tickets, messages, and attachments. Internal notes stay staff-only."
      />
      {(tickets ?? []).length === 0 ? (
        <EmptyState title="No tickets yet" description="User-created tickets will appear here." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {(tickets ?? []).map((t) => (
              <li key={t.id} className="px-4 py-3 text-small">
                <a href={`/admin/support?ticket=${t.id}`} className="font-medium underline-offset-4 hover:underline">
                  {t.subject}
                </a>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {t.status} · {t.priority}
                </p>
              </li>
            ))}
          </ul>
          {selectedId ? (
            <TicketPanel
              ticketId={selectedId}
              messages={messages as {
                id: string;
                body: string;
                is_internal: boolean;
                created_at: string;
                author_user_id: string;
              }[]}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
