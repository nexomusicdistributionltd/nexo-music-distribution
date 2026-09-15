import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmailTemplateEditor } from "@/components/admin/EmailTemplateEditor";
import { createClient } from "@/lib/supabase/server";
import { isProtectedSeedCategory } from "@/lib/email/template-keys";

export const metadata: Metadata = {
  title: "Edit email template",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditEmailTemplatePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await RequireAdminPermission("admin:emails");
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("key, name, category, subject, html_body")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    return (
      <p className="text-small text-red-400">Failed to load template: {error.message}</p>
    );
  }
  if (!data) notFound();

  return (
    <div>
      <PageHeader
        title={data.name}
        description="Edits apply to the next enqueue. Delivery status is still pending, unavailable, failed, or sent only after the provider accepts."
      />
      <EmailTemplateEditor
        templateKey={data.key}
        name={data.name}
        category={data.category}
        subject={data.subject}
        htmlBody={data.html_body}
        canDelete={!isProtectedSeedCategory(String(data.category))}
      />
    </div>
  );
}
