import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { FooterLinksAdminClient } from "@/components/admin/FooterLinksAdminClient";
import { listFooterLinks } from "@/lib/website/footer-links";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Footer links",
  robots: { index: false, follow: false },
};

export default async function AdminFooterLinksPage() {
  await RequireAdminPermission("admin:settings");
  const rows = await listFooterLinks({ includeDisabled: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Footer links"
        description="Manage the public Nexo footer without editing source code. Existing routes remain untouched."
      />
      <FooterLinksAdminClient rows={rows} />
    </div>
  );
}
