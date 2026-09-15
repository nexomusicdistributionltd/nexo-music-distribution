import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { buttonVariants } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { seedMissingEmailTemplates } from "@/lib/email/stored";

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
        description="Admin-owned branded HTML. Ops templates are seeded from the repo; newsletter and custom stay in the dark Nexo shell. Auth Go templates remain in supabase/templates."
        actions={
          <Link href="/admin/emails/templates/new" className={buttonVariants({ size: "sm" })}>
            Create from shell
          </Link>
        }
      />
      {seed.error ? (
        <Alert variant="warning" title="Seed skipped" className="mb-4">
          {seed.error} Apply migration{" "}
          <code>supabase/migrations/20260915090100_email_templates.sql</code> if the table is missing.
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
        <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          <table className="min-w-full text-left text-small">
            <thead className="bg-[var(--nexo-surface)] text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nexo-border)]">
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2 font-mono text-caption">{row.key}</td>
                  <td className="px-3 py-2">
                    <Badge>{row.category}</Badge>
                  </td>
                  <td className="max-w-[18rem] truncate px-3 py-2 text-[var(--nexo-text-secondary)]">
                    {row.subject}
                  </td>
                  <td className="px-3 py-2 text-caption">
                    {row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/emails/templates/${encodeURIComponent(row.key)}`}
                        className="text-caption underline-offset-4 hover:underline"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/admin/emails/send?template=${encodeURIComponent(row.key)}`}
                        className="text-caption underline-offset-4 hover:underline"
                      >
                        Send
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
