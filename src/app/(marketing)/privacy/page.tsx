import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/PageHero";
import { SafeHtml } from "@/components/cms/SafeHtml";
import { getPublishedPageBySlug } from "@/lib/cms/pages";
import { SITE_URL } from "@/lib/site";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

export default async function PrivacyPage() {
  const page = await getPublishedPageBySlug("privacy");

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title={page?.title || "Privacy Policy"}
        crumbs={[
          { label: "Home", href: "/" },
          { label: page?.title || "Privacy Policy" },
        ]}
        showAside={false}
      />
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {page ? (
          <SafeHtml
            html={page.body_html}
            className="prose prose-neutral dark:prose-invert max-w-none"
          />
        ) : (
          <Alert variant="warning" title="Not published yet">
            This legal page exists in the CMS but is not published. Staff can
            publish it from Admin → Pages. The footer link stays live so it is
            never a dead button.
          </Alert>
        )}
      </section>
    </>
  );
}
