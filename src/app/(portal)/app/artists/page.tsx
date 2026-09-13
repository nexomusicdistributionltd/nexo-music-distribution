import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/app/ComingSoonPanel";
import { Alert } from "@/components/ui/Alert";
import { RequireRole } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Roster",
  robots: { index: false, follow: false },
};

export default async function LabelArtistsPage() {
  await RequireRole("label");
  return (
    <div className="space-y-4">
      <h1 className="text-h2">Artists</h1>
      <Alert>
        Label roster tools live here. The public For Artists page remains at <strong>/artists</strong>.
      </Alert>
      <ComingSoonPanel title="No roster data yet" />
    </div>
  );
}
