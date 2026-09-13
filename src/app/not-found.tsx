import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">404</p>
      <h1 className="text-h2">Page not found</h1>
      <p className="text-small text-[var(--nexo-text-muted)]">
        The page you requested does not exist or has moved.
      </p>
      <Link
        href="/"
        className="rounded-[var(--nexo-radius-md)] bg-[var(--nexo-accent)] px-4 py-2 text-small font-medium text-white"
      >
        Back to home
      </Link>
    </div>
  );
}
