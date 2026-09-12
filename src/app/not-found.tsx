import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/marketing/Section";

export default function NotFound() {
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in srgb, var(--nexo-text) 8%, transparent), transparent 60%)",
        }}
      />
      <div className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col items-start justify-center px-4 py-24 sm:px-6 lg:px-8">
        <Eyebrow>404</Eyebrow>
        <h1 className="mt-4 text-display text-[var(--nexo-text)]">Page not found</h1>
        <p className="mt-4 max-w-lg text-body text-[var(--nexo-text-muted)]">
          That route is not part of the NEXO public site — or it may have moved. Try the
          homepage, distribution, or contact pages.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/">
            <Button className="gap-2 rounded-full">
              Home <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="outline" className="rounded-full">
              Contact
            </Button>
          </Link>
          <Link href="/faq">
            <Button variant="ghost" className="rounded-full">
              FAQ
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
