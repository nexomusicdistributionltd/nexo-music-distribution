import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginOtpForm } from "@/components/auth/LoginOtpForm";
import { LOGIN_PATH } from "@/lib/auth/login-otp/constants";
import { isCurrentSessionOtpVerified } from "@/lib/auth/login-otp/status";
import { getOptionalAuth } from "@/lib/auth/guards";
import { homePathForRoles } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify sign-in",
  robots: { index: false, follow: false },
};

export default async function LoginVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const ctx = await getOptionalAuth();
  if (!ctx) {
    redirect(`${LOGIN_PATH}?reason=auth-required`);
  }

  if (await isCurrentSessionOtpVerified()) {
    redirect(homePathForRoles(ctx.roles));
  }

  const sp = await searchParams;
  const from = Array.isArray(sp.from) ? sp.from[0] : sp.from;

  return (
    <AuthCard
      title="Verify it’s you"
      description="Enter the code we sent to your registered email to continue."
    >
      <LoginOtpForm initialFrom={from} />
    </AuthCard>
  );
}
