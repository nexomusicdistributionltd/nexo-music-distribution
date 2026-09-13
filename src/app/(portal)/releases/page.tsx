import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/app/ComingSoonPanel";
import { RequireVerifiedEmail } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Releases",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await RequireVerifiedEmail();
  return (
    <div className="space-y-4">
      <h1 className="text-h2">Releases</h1>
      <ComingSoonPanel title="Releases is coming soon" />
    </div>
  );
}
