import type { Metadata } from "next";
import Link from "next/link";
import { RequireRole } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { portalSectionsForKind } from "@/lib/portal/ia";
import { workspaceKindForRoles } from "@/lib/auth/nav";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

export default async function AnalyticsHubPage() {
  const ctx = await RequireRole(["artist", "label"]);
  const kind = workspaceKindForRoles(ctx.roles);
  const section = portalSectionsForKind(kind === "label" ? "label" : "artist").find((s) => s.id === "analytics");
  return (
    <div className="space-y-6">
      <PageIntro
        title="Analytics"
        description="Statement-backed rows only. DSP dashboards stay EMPTY or NOT CONNECTED until ingest exists — never invented stream counts."
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
