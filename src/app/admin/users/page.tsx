import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/app/ComingSoonPanel";
import { RequireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await RequireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-h2">Users</h1>
      <ComingSoonPanel title="Users" description="Users tools are scaffolded. No fabricated users, releases, or audit rows." />
    </div>
  );
}
