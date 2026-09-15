import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { seedMissingEmailTemplates } from "@/lib/email/stored";
import { EmailTemplatesWorkspace } from "@/components/admin/EmailTemplatesWorkspace";

export const metadata: Metadata = {
  title: "Email templates",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminEmailTemplatesPage() {
  const ctx = await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const seed = await seedMissingEmailTemplates(supabase, ctx.userId);
  const { data, error } = await supabase
    .from("email_templates")
    .select("key, name, category, subject, updated_at")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  const rows = data ?? [];

  return (
    <div>
      <PageHeader
        title="Email templates"
        description="Admin-owned branded HTML from the NexoBot catalog. Search, preview, and edit permitted content. Auth Go templates remain hosted by Supabase."
        actions={
          <Link href="/admin/emails/templates/new" className={buttonVariants({ size: "sm" })}>
            Create from shell
          </Link>
        }
      />
      {seed.error ? (
        <Alert variant="warning" title="Seed skipped" className="mb-4">
          {seed.error} Apply migration{" "}
          <code>supabase/migrations/20260915700001_email_templates.sql</code> if the table is missing.
        </Alert>
      ) : seed.inserted > 0 ? (
        <Alert className="mb-4" title="Catalog seeded">
          Inserted {seed.inserted} missing template(s) from the repo. Existing admin edits were left unchanged.
        </Alert>
      ) : null}
      {error ? (
        <p className="text-small text-red-400">Failed to load: {error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No templates stored yet"
          description="Apply the email_templates migration, then reload this page to seed from emails/templates."
          action={
            <Link href="/admin/emails/templates/new" className={buttonVariants({ size: "sm" })}>
              Create from shell
            </Link>
          }
        />
      ) : (
        <EmailTemplatesWorkspace
          rows={rows.map((row) => ({
            key: row.key,
            name: row.name,
            category: row.category,
            subject: row.subject,
            updated_at: row.updated_at,
          }))}
        />
      )}
    </div>
  );
}
