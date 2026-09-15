import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { getPageAdmin } from "@/lib/cms/pages";
import { CmsPageEditor } from "@/components/cms/CmsPageEditor";

export const metadata: Metadata = {
  title: "Edit page",
  robots: { index: false, follow: false },
};

export default async function EditCmsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await RequireAdmin();
  const { id } = await params;
  const page = await getPageAdmin(id);
  if (!page) notFound();

  return (
    <div>
      <PageHeader title={page.title} description={`/${page.slug}`} />
      <CmsPageEditor page={page} />
    </div>
  );
}
