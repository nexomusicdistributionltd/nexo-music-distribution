import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { getPostAdmin } from "@/lib/blog/queries";
import { BlogCreateForm } from "@/components/blog/BlogCreateForm";

export const metadata: Metadata = {
  title: "Edit blog post",
  robots: { index: false, follow: false },
};

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await RequireAdmin();
  const { id } = await params;
  const post = await getPostAdmin(id);
  if (!post) notFound();

  return (
    <div>
      <PageHeader title="Edit post" description={post.slug} />
      <BlogCreateForm
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          body_html: post.body_html,
          status: post.status,
          cover_image_url: post.cover_image_url,
          tags: post.tags,
        }}
      />
    </div>
  );
}
