import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { listAllPagesAdmin } from "@/lib/cms/pages";

export const metadata: Metadata = {
  title: "CMS pages",
  robots: { index: false, follow: false },
};

export default async function AdminPagesPage() {
  await RequireAdmin();
  const pages = await listAllPagesAdmin();

  return (
    <div>
      <PageHeader
        title="Pages"
        description="Legal and custom CMS pages. Publish Privacy/Terms/Cookies to complete the footer."
      />
      <ul className="mt-4 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
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
    </div>
  );
}
