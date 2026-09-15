import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { listAllPartnersAdmin } from "@/lib/website/partners";
import { PartnersAdminClient } from "@/components/website/PartnersAdminClient";

export const metadata: Metadata = {
  title: "Partners",
  robots: { index: false, follow: false },
};

export default async function AdminPartnersPage() {
  await RequireAdmin();
  const partners = await listAllPartnersAdmin();
  return (
    <div>
      <PageHeader
        title="Partners"
        description="Active partners appear in the public logo marquee (seamless RTL)."
      />
      <PartnersAdminClient partners={partners} />
    </div>
  );
}
