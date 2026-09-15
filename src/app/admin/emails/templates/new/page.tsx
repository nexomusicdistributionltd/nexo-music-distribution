import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { CreateFromShellForm } from "@/components/admin/CreateFromShellForm";

export const metadata: Metadata = {
  title: "Create email template",
  robots: { index: false, follow: false },
};

export default async function NewEmailTemplatePage() {
  await RequireAdminPermission("admin:emails");
  return (
    <div>
      <PageHeader
        title="Create from dark shell"
        description="Clones the Nexo branded shell (dark field, silver wordmark, LTD footer, social icons). Edit subject and HTML after create."
      />
      <CreateFromShellForm />
    </div>
  );
}
