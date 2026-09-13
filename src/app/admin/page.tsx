import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/releases/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAdminOperationalCounts } from "@/lib/admin/queries";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { getProviderConnectionState } from "@/lib/provider";

export const metadata: Metadata = {
  title: "Admin operations",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  await RequireAdmin();
  const counts = await getAdminOperationalCounts();
  const provider = getProviderConnectionState();

  const cards = [
    { label: "Releases", value: counts.releases, href: "/admin/releases" },
    { label: "Submitted", value: counts.submitted, href: "/admin/qc" },
    { label: "In QC", value: counts.inQc, href: "/admin/qc" },
    { label: "Artists", value: counts.artists, href: "/admin/artists" },
    { label: "Labels", value: counts.labels, href: "/admin/labels" },
    { label: "Open tickets", value: counts.openTickets, href: "/admin/support" },
    { label: "New contact", value: counts.newContact, href: "/admin/contact" },
    { label: "Compliance open", value: counts.openCompliance, href: "/admin/compliance" },
  ];

  const totalActivity = cards.reduce((s, c) => s + (typeof c.value === "number" ? c.value : 0), 0);

  return (
    <div>
      <PageHeader
        title="Operations center"
        description="Live operational counts from the database. Empty when no data exists — nothing is fabricated."
        showSearch
      />
      <div className="mb-6">
        <ProviderBanner connected={provider.connected} />
      </div>
      {totalActivity === 0 ? (
        <EmptyState
          title="No operational data yet"
          description="When artists submit releases or contact arrives, counts will appear here."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.label} href={c.href} className="block transition-opacity hover:opacity-90">
              <StatCard label={c.label} value={c.value} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
