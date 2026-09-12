import type { Metadata } from "next";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--nexo-bg)]">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 py-12">{children}</main>
    </div>
  );
}
