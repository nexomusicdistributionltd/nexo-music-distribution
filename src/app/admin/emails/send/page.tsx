import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmailSendComposer } from "@/components/admin/EmailSendComposer";
import { createClient } from "@/lib/supabase/server";
import { seedMissingEmailTemplates } from "@/lib/email/stored";
import { getEmailProviderStatus } from "@/lib/email/provider";
import { listAdminEmailDirectory } from "@/lib/email/admin-recipients";

export const metadata: Metadata = {
  title: "Send email template",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminEmailSendPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const ctx = await RequireAdminPermission("admin:emails");
  const sp = await searchParams;
  const supabase = await createClient();
  await seedMissingEmailTemplates(supabase, ctx.userId);
  const provider = getEmailProviderStatus();

  const [{ data: templates, error: tmplError }, directory] = await Promise.all([
    supabase
      .from("email_templates")
      .select("key, name, category, subject")
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    listAdminEmailDirectory(supabase),
  ]);

  return (
    <div>
      <PageHeader
        title="Send template"
        description="Pick a stored template and any mix of artists, labels, users, or typed addresses. Directory emails resolve from the database; custom To addresses are used on send. Confirm before enqueue into email_outbound_events — SENT is never fabricated."
      />
      {tmplError ? (
        <p className="mb-4 text-small text-red-400">Templates: {tmplError.message}</p>
      ) : null}
      {directory.errors.length > 0 ? (
        <p className="mb-4 text-small text-red-400">{directory.errors.join(" · ")}</p>
      ) : null}
      <EmailSendComposer
        templates={templates ?? []}
        directory={directory.recipients}
        defaultTemplateKey={sp.template}
        providerMessage={provider.message}
        providerConfigured={provider.configured}
      />
    </div>
  );
}
