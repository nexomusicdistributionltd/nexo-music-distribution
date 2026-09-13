import type { Metadata } from "next";
import { ReleaseWizard } from "@/components/releases/ReleaseWizard";
import { RequireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "New release",
  robots: { index: false, follow: false },
};

export default async function NewReleasePage() {
  await RequireRole(["artist", "label"]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2">Create release</h1>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          Multi-step wizard — drafts save as you continue. No ISRC/UPC is auto-fabricated.
        </p>
      </div>
      <ReleaseWizard mode="create" />
    </div>
  );
}
