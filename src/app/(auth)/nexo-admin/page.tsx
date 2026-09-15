import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdministratorAccessDenied } from "@/components/auth/AdministratorAccessDenied";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoadingState } from "@/components/ui/LoadingState";
import { isAdministratorRole } from "@/lib/admin/permissions";
import { getOptionalAuth } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Administrator sign-in",
  description: "Secure administrator access to Nexo Admin Center.",
  robots: { index: false, follow: false },
};

export default async function NexoAdminLoginPage() {
  const ctx = await getOptionalAuth();

  if (ctx && isAdministratorRole(ctx.roles)) {
    redirect("/admin");
  }

  if (ctx) {
    return (
      <AuthCard
        title="Administrator access"
        description="Nexo Admin Center is limited to authorized administrators."
        footer={
          <>
            Need the staff portal?{" "}
            <Link href="/login" className="underline underline-offset-4 hover:text-[var(--nexo-text)]">
              Use standard sign-in
            </Link>
          </>
        }
      >
        <AdministratorAccessDenied />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Administrator sign-in"
      description="Sign in with an administrator account to open Admin Center."
      footer={
        <>
          Not an administrator?{" "}
          <Link href="/login" className="underline underline-offset-4 hover:text-[var(--nexo-text)]">
            Go to standard sign-in
          </Link>
        </>
      }
    >
      <Suspense fallback={<LoadingState label="Loading administrator sign-in…" />}>
        <LoginForm mode="administrator" />
      </Suspense>
    </AuthCard>
  );
}
