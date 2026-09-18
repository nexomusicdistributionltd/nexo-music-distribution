import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { listAllPagesAdmin } from "@/lib/cms/pages";
import { getWebsiteSetting } from "@/lib/website/queries";
import { FooterSettingsClient } from "@/components/website/FooterSettingsClient";

export const metadata: Metadata = {
  title: "CMS pages",
  robots: { index: false, follow: false },
};

export default async function AdminPagesPage() {
  await RequireAdmin();
  const [pages, footer] = await Promise.all([
    listAllPagesAdmin(),
    getWebsiteSetting("footer"),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pages & footer"
        description="Edit footer content and manage every CMS-backed footer/legal page. Published changes refresh the public website in realtime."
      />
      <FooterSettingsClient initial={(footer?.value as Record<string, unknown>) ?? {}} />
      <section>
        <h2 className="mb-3 text-h4">Footer and legal pages</h2>
        <ul className=" divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
        {pages.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-4 py-3 text-small">
            <div>
              <p className="font-medium">{p.title}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                /{p.slug} · {p.page_kind} · {p.status}
              </p>
            </div>
            <Link href={`/admin/pages/${p.id}`} className="underline">
              Edit
            </Link>
          </li>
        ))}
        </ul>
      </section>
    </div>
  );
}
