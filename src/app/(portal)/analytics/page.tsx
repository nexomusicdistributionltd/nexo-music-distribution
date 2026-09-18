import type { Metadata } from "next";
import Link from "next/link";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { portalSectionsForKind } from "@/lib/portal/ia";
import { workspaceKindForRoles } from "@/lib/auth/nav";
import { getEntitlementsForAuth } from "@/lib/billing/queries";
import { isFeatureUnlocked, pricingHrefForAccount } from "@/lib/billing/feature-access";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

export default async function AnalyticsHubPage() {
  const ctx = await RequireVerifiedPortal();
  const entitlements = await getEntitlementsForAuth(ctx);
  const kind = workspaceKindForRoles(ctx.roles);
  const section = portalSectionsForKind(kind === "label" ? "label" : "artist").find((s) => s.id === "analytics");
  if (!isFeatureUnlocked(entitlements, "advanced_analytics")) {
    return <div className="space-y-6"><PageIntro title="Analytics" description="Detailed distribution analytics are available on eligible plans." /><section className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6"><h2 className="text-h4">Upgrade to unlock advanced analytics</h2><Link className="mt-4 inline-flex rounded-full bg-[var(--nexo-text)] px-4 py-2 text-small font-semibold [color:var(--nexo-text-inverse)]" href={pricingHrefForAccount(entitlements.accountType)}>View plans</Link></section></div>;
  }
  return (
    <div className="space-y-6">
      <PageIntro
        title="Analytics"
        description="Verified distribution analytics and statement-backed rows only. Nexo never invents stream counts."
      />
      <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
        {(section?.items ?? []).map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex items-center justify-between px-4 py-3 text-small hover:bg-[var(--nexo-ghost-hover)]">
              <span>
                {item.label}
                {item.badge === "NEW" ? (
                  <span className="ml-2 rounded-full bg-[var(--nexo-success-bg)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase text-[var(--nexo-success)]">
                    NEW
                  </span>
                ) : null}
              </span>
              <span className="text-caption text-[var(--nexo-text-muted)]">Open</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
