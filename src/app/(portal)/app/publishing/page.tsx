import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/app/ComingSoonPanel";
import { Alert } from "@/components/ui/Alert";
import { RequireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Publishing",
  robots: { index: false, follow: false },
};

export default async function AppPublishingPage() {
  await RequireRole(["artist", "label", "admin", "super_admin"]);
  return (
    <div className="space-y-4">
      <h1 className="text-h2">Publishing</h1>
      <Alert>
        The public marketing page remains at <strong>/publishing</strong>. This authenticated
        workspace is for artist/label publishing tools (not connected yet).
      </Alert>
      <ComingSoonPanel title="Publishing tools coming soon" />
    </div>
  );
}
