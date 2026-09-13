import type { Metadata } from "next";
import { SettingsForm } from "@/components/releases/SettingsForm";
import { Alert } from "@/components/ui/Alert";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { RequireAuth } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const ctx = await RequireAuth();
  if (!ctx.profile) {
    return (
      <Alert variant="error" title="Profile missing">
        No profile row found.
      </Alert>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2">Settings</h1>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          Timezone, language, and profile preferences.
        </p>
      </div>
      <ProviderBanner connected={false} />
      <SettingsForm profile={ctx.profile} />
    </div>
  );
}
