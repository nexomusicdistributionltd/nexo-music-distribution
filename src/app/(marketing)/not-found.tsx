import Link from "next/link";
import { CircularCta } from "@/components/public/CircularCta";
import { DisplayHeading } from "@/components/public/DisplayHeading";

export default function NotFound() {
  return (
    <div className="pub-container flex min-h-[70vh] flex-col items-start justify-center py-24">
      <p className="pub-kicker">404</p>
      <DisplayHeading as="h1" size="lg" className="mt-4">
        Page not found.
      </DisplayHeading>
      <p className="pub-body mt-6 max-w-md">
        That route is not part of the NEXO public site — or it may have moved.
      </p>
      <div className="mt-10">
        <CircularCta href="/">Back home →</CircularCta>
      </div>
      <p className="mt-8 text-small text-[var(--nexo-text-muted)]">
        <Link href="/contact" className="underline underline-offset-4">
          Contact
        </Link>
        {" · "}
        <Link href="/faq" className="underline underline-offset-4">
          FAQ
        </Link>
      </p>
    </div>
  );
}
