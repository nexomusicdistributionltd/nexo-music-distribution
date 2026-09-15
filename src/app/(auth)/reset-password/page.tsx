import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { resetPasswordForwardPath } from "@/lib/auth/recovery-urls";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string | string[];
    token_hash?: string | string[];
    type?: string | string[];
    reason?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const forward = resetPasswordForwardPath({
    code: firstParam(sp.code),
    token_hash: firstParam(sp.token_hash),
    type: firstParam(sp.type),
  });
  if (forward) {
    redirect(forward);
  }

  const reason = firstParam(sp.reason);

  return (
    <AuthCard
      title="Set new password"
      description="Choose a strong new password for your account."
    >
      <ResetPasswordForm initialReason={reason} />
    </AuthCard>
  );
}
