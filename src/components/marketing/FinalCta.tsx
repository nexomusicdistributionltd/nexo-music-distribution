import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/marketing/Section";
import { EditorialImage } from "@/components/website/EditorialImage";

export function FinalCta({
  title = "Ready to move your catalog forward?",
  description = "Talk with Nexo about distribution, publishing, and royalty workflows built for independent artists and labels.",
  imageSrc,
  aboutImageSrc,
}: {
  title?: string;
  description?: string;
  /** Optional CTA editorial image (resolved URL). */
  imageSrc?: string;
  /** Optional about strip image shown above CTA actions on large screens. */
  aboutImageSrc?: string;
}) {
  const showImages = Boolean(imageSrc || aboutImageSrc);

  return (
    <section className="border-t border-[var(--nexo-border)] bg-[var(--nexo-elevated)] overflow-x-hidden">
      <div
        className={
          showImages
            ? "mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8"
            : "mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:px-8"
        }
      >
        <div className="max-w-2xl">
          <Eyebrow>Next step</Eyebrow>
          <h2 className="mt-3 text-h2 text-[var(--nexo-text)]">{title}</h2>
          <p className="mt-3 text-body text-[var(--nexo-text-muted)]">{description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/get-started">
              <Button size="lg" className="gap-2 rounded-full px-6">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="rounded-full px-6">
                Contact
              </Button>
            </Link>
          </div>
        </div>
        {showImages ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {aboutImageSrc ? (
              <EditorialImage
                src={aboutImageSrc}
                fallbackPreset="studio"
                alt="Nexo studio atmosphere"
                motion="mask-left"
                aspectClassName="aspect-[4/3]"
                hoverZoom
              />
            ) : null}
            {imageSrc ? (
              <EditorialImage
                src={imageSrc}
                fallbackPreset="vinyl"
                alt="Nexo catalog ready"
                motion="clip-diagonal"
                aspectClassName="aspect-[4/3]"
                hoverZoom
              />
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 lg:hidden" />
        )}
      </div>
    </section>
  );
}
