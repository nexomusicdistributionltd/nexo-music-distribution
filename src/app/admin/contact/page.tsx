import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { ContactInboxActions } from "@/components/admin/ContactInboxActions";
import { EmailsSubnav } from "@/components/admin/EmailsSubnav";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Contact inbox",
  robots: { index: false, follow: false },
};

export default async function ContactInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await RequireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const items = data ?? [];
  const selected = items.find((m) => m.id === sp.id) ?? items[0] ?? null;

  return (
    <div className="space-y-6">
      <EmailsSubnav />
      <PageIntro title="Website Messages" description="Public contact form. Replies use existing staff tools — no new email provider. Artist and Label cannot access this mailbox." />
      {items.length === 0 ? (
        <EmptyState title="Inbox empty" description="Public contact submissions will appear here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
          <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
            {items.map((m) => (
              <li key={m.id}>
                <a
                  href={`/admin/contact?id=${m.id}`}
                  className={cn(
                    "block px-3 py-3 hover:bg-[var(--nexo-ghost-hover)]",
                    selected?.id === m.id && "bg-[var(--nexo-elevated)]"
                  )}
                >
                  <p className="truncate text-small font-medium">{m.subject}</p>
                  <p className="truncate text-caption text-[var(--nexo-text-muted)]">
                    {m.name} · {m.status}
                  </p>
                </a>
              </li>
            ))}
          </ul>
          {selected ? (
            <article className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-h4">{selected.subject}</h2>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {selected.name} · {selected.email} · {selected.status} ·{" "}
                    {new Date(selected.created_at).toLocaleString()}
                  </p>
                </div>
                <ContactInboxActions id={selected.id} status={selected.status} />
              </div>
              <p className="mt-4 whitespace-pre-wrap text-small">{selected.message}</p>
            </article>
          ) : null}
        </div>
      )}
    </div>
  );
}
