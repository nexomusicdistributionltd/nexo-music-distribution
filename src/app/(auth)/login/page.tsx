import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoadingState } from "@/components/ui/LoadingState";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to NEXO Music Distribution.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      description="Access your artist, label, or staff workspace."
      footer={
        <>
          New to Nexo?{" "}
          <Link href="/register" className="underline underline-offset-4 hover:text-[var(--nexo-text)]">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<LoadingState label="Loading sign-in…" />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
