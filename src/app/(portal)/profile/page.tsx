import type { Metadata } from "next";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { Alert } from "@/components/ui/Alert";
import { RequireAuth } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const ctx = await RequireAuth();
  if (!ctx.profile) {
    return (
      <Alert variant="error" title="Profile missing">
        Your auth user exists but no profile row was found. Re-run Supabase migrations or contact support.
      </Alert>
    );
  }

  if (!ctx.emailVerified) {
    // Allow limited profile while prompting verification
  }

  return (
    <div className="space-y-6">
      {!ctx.emailVerified ? (
        <Alert variant="warning" title="Email not verified">
          Verify your email to unlock the full portal.{" "}
          <a href="/verify-email" className="underline underline-offset-4">
            Resend verification
          </a>
        </Alert>
      ) : null}
      <ProfileForm profile={ctx.profile} roles={ctx.roles} email={ctx.email} />
    </div>
  );
}
