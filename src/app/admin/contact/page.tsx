import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { ContactInboxActions } from "@/components/admin/ContactInboxActions";

export const metadata: Metadata = {
  title: "Contact inbox",
  robots: { index: false, follow: false },
};

export default async function ContactInboxPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Contact inbox"
        description="Messages from the public contact form."
      />
      {(data ?? []).length === 0 ? (
        <EmptyState title="Inbox empty" description="Public contact submissions will appear here." />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((m) => (
            <li
              key={m.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{m.subject}</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {m.name} · {m.email} · {m.status} ·{" "}
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-small">{m.message}</p>
                </div>
                <ContactInboxActions id={m.id} status={m.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
