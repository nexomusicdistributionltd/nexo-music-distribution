import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmailSendComposer } from "@/components/admin/EmailSendComposer";
import { createClient } from "@/lib/supabase/server";
import { seedMissingEmailTemplates } from "@/lib/email/stored";
import { getEmailProviderStatus } from "@/lib/email/provider";

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

  const [{ data: templates, error: tmplError }, { data: users, error: userError, count }] =
    await Promise.all([
      supabase
        .from("email_templates")
        .select("key, name, category, subject")
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, email, display_name, full_name", { count: "exact" })
        .not("email", "is", null)
        .neq("email", "")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  const sendableUsers = (users ?? [])
    .filter((u) => Boolean(u.email))
    .map((u) => ({
      id: u.id,
      email: u.email as string,
      label: u.display_name || u.full_name || (u.email as string),
    }));

  return (
    <div>
      <PageHeader
        title="Send template"
        description="Pick a stored template and recipients from the user directory. Addresses always resolve from profiles. Confirm before enqueue into email_outbound_events — SENT is never fabricated."
      />
      {tmplError ? (
        <p className="mb-4 text-small text-red-400">Templates: {tmplError.message}</p>
      ) : null}
      {userError ? (
        <p className="mb-4 text-small text-red-400">Users: {userError.message}</p>
      ) : null}
      <EmailSendComposer
        templates={templates ?? []}
        users={sendableUsers}
        userCount={count ?? sendableUsers.length}
        defaultTemplateKey={sp.template}
        providerMessage={provider.message}
        providerConfigured={provider.configured}
      />
    </div>
  );
}
