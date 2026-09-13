import type { Metadata } from "next";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { Alert } from "@/components/ui/Alert";
import { RequireAuth } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function DashboardProfilePage() {
  const ctx = await RequireAuth();
  if (!ctx.profile) {
    return (
      <Alert variant="error" title="Profile missing">
        No profile row found. Re-run Supabase migrations or contact support.
      </Alert>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2">Profile</h1>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          Account details from your existing profile schema.
        </p>
      </div>
      <ProfileForm profile={ctx.profile} roles={ctx.roles} email={ctx.email} />
    </div>
  );
}
