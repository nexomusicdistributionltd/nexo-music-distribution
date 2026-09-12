import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/app/ComingSoonPanel";
import { RequireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Catalog",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await RequireAdmin();
  return (
    <div className="space-y-4">
      <h1 className="text-h2">Catalog</h1>
      <ComingSoonPanel title="Catalog" description="Catalog tools are scaffolded. No fabricated users, releases, or audit rows." />
    </div>
  );
}
