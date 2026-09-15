import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmailComposeForm } from "@/components/admin/EmailComposeForm";
import { createClient } from "@/lib/supabase/server";
import { getEmailProviderStatus } from "@/lib/email/provider";
import { replySubject } from "@/lib/email/thread";

export const metadata: Metadata = {
  title: "Compose email",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminEmailComposePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await RequireAdminPermission("admin:emails");
  const sp = await searchParams;
  const str = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const provider = getEmailProviderStatus();
  const supabase = await createClient();
  const { data: drafts } = await supabase
    .from("email_drafts")
    .select("id, subject, updated_at")
    .order("updated_at", { ascending: false })
    .limit(8);

  const replyTo = str("to") || str("replyTo");
  const subjectRaw = str("subject");
  const isReply = Boolean(str("inReplyTo") || str("replyTo"));

  return (
    <div>
      <PageHeader
        title={isReply ? "Reply" : "Compose"}
        description="Send any address via Zoho Mail SMTP (same transport as newsletter). To / CC / BCC from the form. SENT only after Zoho returns a message id."
      />
      <EmailComposeForm
        defaultTo={replyTo}
        defaultCc={str("cc")}
        defaultSubject={isReply && subjectRaw ? replySubject(subjectRaw) : subjectRaw}
        inReplyTo={str("inReplyTo")}
        references={str("references")}
        providerConfigured={provider.configured}
        providerMessage={provider.message}
      />
      {(drafts ?? []).length > 0 ? (
        <section className="mt-8">
          <h2 className="text-h4">Recent drafts</h2>
          <ul className="mt-2 space-y-1 text-small">
            {(drafts ?? []).map((d) => (
              <li key={d.id} className="text-[var(--nexo-text-muted)]">
                {d.subject || "(no subject)"} · {new Date(d.updated_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
