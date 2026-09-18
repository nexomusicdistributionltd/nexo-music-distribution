import type { Metadata } from "next";
import { IdentityVerificationWizard } from "@/components/verification/IdentityVerificationWizard";
import { VerificationRealtime } from "@/components/verification/VerificationRealtime";
import { RequireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type {
  IdentityEvidence,
  IdentityVerification,
} from "@/lib/verification/types";

export const metadata: Metadata = {
  title: "Verify identity",
  robots: { index: false, follow: false },
};

export default async function IdentityVerificationPage() {
  const ctx = await RequireRole(["artist", "label"]);
  const supabase = await createClient();

  const [{ data: verification }, { data: evidence }] = await Promise.all([
    supabase
      .from("identity_verifications")
      .select("*")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    supabase
      .from("identity_verification_evidence")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("captured_at", { ascending: true }),
  ]);

  return (
    <>
      <VerificationRealtime userId={ctx.userId} />
      <IdentityVerificationWizard
        userId={ctx.userId}
        accountType={ctx.roles.includes("label") ? "label" : "artist"}
        profileFullName={ctx.profile?.full_name ?? ""}
        profileCountry={ctx.profile?.country ?? null}
        initialVerification={(verification as IdentityVerification | null) ?? null}
        initialEvidence={(evidence as IdentityEvidence[] | null) ?? []}
      />
    </>
  );
}
