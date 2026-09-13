import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/app/ComingSoonPanel";
import { RequireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await RequireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-h2">Settings</h1>
      <ComingSoonPanel title="Settings" description="Settings tools are scaffolded. No fabricated users, releases, or audit rows." />
    </div>
  );
}
