import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { VerifyEmailPanel } from "@/components/auth/VerifyEmailPanel";
import { LoadingState } from "@/components/ui/LoadingState";
import { getOptionalAuth } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Verify email",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage() {
  const ctx = await getOptionalAuth();
  return (
    <AuthCard title="Verify your email" description="Almost there — confirm your email to unlock the portal.">
      <Suspense fallback={<LoadingState label="Loading…" />}>
        <VerifyEmailPanel email={ctx?.email} />
      </Suspense>
    </AuthCard>
  );
}
