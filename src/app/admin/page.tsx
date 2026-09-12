import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/app/ComingSoonPanel";
import { RequireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Admin dashboard",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await RequireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-h2">Admin dashboard</h1>
      <ComingSoonPanel title="Admin dashboard" description="Staff overview will appear here once operational modules are connected." />
    </div>
  );
}
