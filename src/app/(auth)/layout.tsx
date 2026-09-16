import type { Metadata } from "next";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { publicDisplay, publicSans } from "@/components/public/fonts";
import "../(marketing)/public.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${publicDisplay.variable} ${publicSans.variable} nexo-public relative flex min-h-screen flex-col bg-[var(--nexo-bg)]`}
    >
      <div className="absolute right-4 top-4 z-10 sm:right-8 sm:top-6">
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 py-20">{children}</main>
    </div>
  );
}
