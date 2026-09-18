import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RequireRole } from "@/lib/auth/guards";
import { getIdentityVerificationForUser } from "@/lib/identity/queries";
import { IdentityVerificationWizard } from "@/components/identity/IdentityVerificationWizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify identity",
  robots: { index: false, follow: false },
};

export default async function VerifyIdentityPage() {
  const ctx = await RequireRole(["artist", "label"], { allowUnverifiedIdentity: true });
  const current = await getIdentityVerificationForUser(ctx.userId);

  if (current?.status === "verified") {
    redirect("/dashboard");
  }

  return (
    <IdentityVerificationWizard
      userId={ctx.userId}
      email={ctx.email}
      current={current}
    />
  );
}
