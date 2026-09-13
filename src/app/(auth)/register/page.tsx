import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { LoadingState } from "@/components/ui/LoadingState";

export const metadata: Metadata = {
  title: "Register",
  description: "Create an artist or label account with NEXO Music Distribution.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create account"
      description="Public signup is available for artists and labels only. Staff accounts are provisioned by Nexo."
    >
      <Suspense fallback={<LoadingState label="Loading registration…" />}>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  );
}
