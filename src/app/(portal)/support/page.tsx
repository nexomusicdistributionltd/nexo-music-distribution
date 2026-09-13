import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RequireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateTicketForm, TicketReplyForm } from "@/components/admin/PortalSupportClient";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const ctx = await RequireAuth();
  if (ctx.roles.some((r) => r === "support" || r === "admin" || r === "super_admin")) {
    redirect("/admin/support");
  }
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("requester_user_id", ctx.userId)
    .order("updated_at", { ascending: false });

  const selectedId = sp.ticket || tickets?.[0]?.id;
  let messages: Array<{
    id: string;
    body: string;
    is_internal: boolean;
    created_at: string;
  }> = [];
  if (selectedId) {
    const { data } = await supabase
      .from("support_messages")
      .select("id, body, is_internal, created_at")
      .eq("ticket_id", selectedId)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });
    messages = data ?? [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2">Support</h1>
        <p className="text-small text-[var(--nexo-text-muted)]">Tickets and private attachments.</p>
      </div>
      <CreateTicketForm />
      {(tickets ?? []).length === 0 ? (
        <EmptyState title="No tickets yet" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {(tickets ?? []).map((t) => (
              <li key={t.id} className="p-3 text-small">
                <Link href={`/support?ticket=${t.id}`} className="font-medium">{t.subject}</Link>
                <p className="text-caption text-[var(--nexo-text-muted)]">{t.status}</p>
              </li>
            ))}
          </ul>
          {selectedId ? (
            <div className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
              <ul className="max-h-80 space-y-2 overflow-y-auto text-small">
                {messages.map((m) => (
                  <li key={m.id} className="rounded-[var(--nexo-radius)] bg-[var(--nexo-elevated)] p-2">
                    <p className="text-caption text-[var(--nexo-text-muted)]">{new Date(m.created_at).toLocaleString()}</p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </li>
                ))}
              </ul>
              <TicketReplyForm ticketId={selectedId} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
