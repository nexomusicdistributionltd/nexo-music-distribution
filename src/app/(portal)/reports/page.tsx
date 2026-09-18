import type { Metadata } from "next";
import Link from "next/link";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageIntro } from "@/components/workspace/PageIntro";
import { loadSalesSnapshot } from "@/lib/portal/sales";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

export default async function ReportsOverviewPage() {
  const ctx = await RequireVerifiedPortal();
  const supabase = await createClient();

  const [sales, releaseResult, payoutResult, ledgerResult] = await Promise.all([
    loadSalesSnapshot(ctx.userId, "overview"),
    supabase
      .from("releases")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", ctx.userId),
    supabase
      .from("payouts")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", ctx.userId),
    supabase
      .from("ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", ctx.userId),
  ]);

  const cards = [
    {
      label: "Sales rows",
      value: sales.connected ? sales.rows.length : 0,
      href: "/sales",
      note: sales.connected ? "Live provider reporting" : "Provider temporarily unavailable",
    },
    {
      label: "Catalog releases",
      value: Number(releaseResult.count ?? 0),
      href: "/dashboard/releases",
      note: "Nexo catalog",
    },
    {
      label: "Royalty ledger rows",
      value: Number(ledgerResult.count ?? 0),
      href: "/earnings",
      note: "Posted Nexo ledger",
    },
    {
      label: "Payout records",
      value: Number(payoutResult.count ?? 0),
      href: "/earnings/payouts",
      note: "Requests and completed payments",
    },
  ];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Reports"
        title="Reporting center"
        description="Sales, catalog, royalties, payouts, release links and stream data from real Nexo and connected-provider records only."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 transition hover:border-[var(--nexo-border-strong)]"
          >
            <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{card.value.toLocaleString("en-US")}</p>
            <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">{card.note}</p>
          </Link>
        ))}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Sales", "/sales", "Overview, releases, tracks, stores/services, artists, territories and stream rates."],
          ["Catalog", "/dashboard/releases", "Release metadata, QC and distribution status."],
          ["Payouts", "/earnings/payouts", "Payment methods, requests and completed payments."],
          ["Release Links", "/dashboard/fanlinks", "Nexo smart links for eligible releases."],
          ["Stream Data", "/analytics/streams", "Verified stream analytics with no generated counts."],
          ["Raw Data", "/reports/raw-data", "Read-only account-scoped provider rows."],
        ].map(([label, href, description]) => (
          <Link
            key={href}
            href={href}
            className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 hover:bg-[var(--nexo-ghost-hover)]"
          >
            <p className="font-medium">{label}</p>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
