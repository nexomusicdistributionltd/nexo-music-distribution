import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function VerificationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--nexo-bg)] text-[var(--nexo-text)]">
      <header className="border-b border-[var(--nexo-border)] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Logo height={24} href="/dashboard" />
          <span className="text-caption text-[var(--nexo-text-muted)]">Secure account setup</span>
        </div>
      </header>
      <main className="px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
