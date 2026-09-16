import { CircularCta } from "@/components/public/CircularCta";
import { DisplayHeading } from "@/components/public/DisplayHeading";

export function FinalCta({
  title = "Ready to be heard?",
  description = "Talk with Nexo about distribution, publishing, and royalty workflows built for independent artists and labels.",
}: {
  title?: string;
  description?: string;
  imageSrc?: string;
  aboutImageSrc?: string;
}) {
  return (
    <section className="relative overflow-hidden border-t border-[var(--nexo-border)]">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 88% 40%, color-mix(in srgb, var(--nexo-text) 16%, transparent), transparent 60%)",
        }}
      />
      <div className="pub-container pub-section relative flex flex-col gap-10 lg:min-h-[28rem] lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <DisplayHeading as="h2">{title}</DisplayHeading>
          <p className="pub-body mt-8 max-w-md">{description}</p>
        </div>
        <CircularCta href="/get-started">Get started →</CircularCta>
      </div>
    </section>
  );
}
