import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { listAllPagesAdmin } from "@/lib/cms/pages";
import { getWebsiteSetting } from "@/lib/website/queries";
import { FooterSettingsClient } from "@/components/website/FooterSettingsClient";
import { REQUIRED_FOOTER_PAGE_SLUGS } from "@/lib/cms/footer-pages";

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

  const requiredOrder = new Map(
    REQUIRED_FOOTER_PAGE_SLUGS.map((slug, index) => [slug, index] as const)
  );
  const footerPages = pages
    .filter((page) => requiredOrder.has(page.slug as (typeof REQUIRED_FOOTER_PAGE_SLUGS)[number]))
    .sort((a, b) => (requiredOrder.get(a.slug as (typeof REQUIRED_FOOTER_PAGE_SLUGS)[number]) ?? 99) - (requiredOrder.get(b.slug as (typeof REQUIRED_FOOTER_PAGE_SLUGS)[number]) ?? 99));
  const otherPages = pages.filter(
    (page) => !requiredOrder.has(page.slug as (typeof REQUIRED_FOOTER_PAGE_SLUGS)[number])
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pages & footer"
        description="Edit footer content and manage every CMS-backed footer/legal page. Published changes refresh the public website in realtime."
      />
      <FooterSettingsClient initial={(footer?.value as Record<string, unknown>) ?? {}} />
      <section>
        <h2 className="mb-3 text-h4">Footer and legal pages</h2>
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {footerPages.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3 text-small">
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  /{p.slug} · {p.status}
                </p>
              </div>
              <Link href={`/admin/pages/${p.id}`} className="underline">
                Edit page
              </Link>
            </li>
          ))}
        </ul>
        {footerPages.length !== REQUIRED_FOOTER_PAGE_SLUGS.length ? (
          <p className="mt-3 text-caption text-[var(--nexo-danger)]">
            One or more required footer pages are missing from the CMS. Apply the latest database migration.
          </p>
        ) : null}
      </section>

      {otherPages.length > 0 ? (
        <section>
          <h2 className="mb-3 text-h4">Other CMS pages</h2>
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {otherPages.map((p) => (
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
      ) : null}
    </div>
  );
}
