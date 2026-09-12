import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/marketing/Section";

export function FinalCta({
  title = "Ready to move your catalog forward?",
  description = "Talk with Nexo about distribution, publishing, and royalty workflows built for independent artists and labels.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="border-t border-[var(--nexo-border)] bg-[var(--nexo-elevated)]">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="max-w-2xl">
          <Eyebrow>Next step</Eyebrow>
          <h2 className="mt-3 text-h2 text-[var(--nexo-text)]">{title}</h2>
          <p className="mt-3 text-body text-[var(--nexo-text-muted)]">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
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
    </section>
  );
}
