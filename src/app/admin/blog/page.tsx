import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { listAllPostsAdmin } from "@/lib/blog/queries";
import { BlogCreateForm } from "@/components/blog/BlogCreateForm";

export const metadata: Metadata = {
  title: "Blog admin",
  robots: { index: false, follow: false },
};

export default async function AdminBlogPage() {
  await RequireAdmin();
  const posts = await listAllPostsAdmin();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Blog"
        description="Create and publish posts. HTML is sanitized server-side."
      />
      <BlogCreateForm />
      <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-4 py-3 text-small">
            <div>
              <p className="font-medium">{p.title}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                /{p.slug} · {p.status}
              </p>
            </div>
            <Link href={`/admin/blog/${p.id}`} className="underline">
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
