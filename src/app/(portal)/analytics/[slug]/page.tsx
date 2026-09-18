import type { Metadata } from "next";
import { PortalFeaturePage } from "@/components/portal/PortalFeaturePage";
import { portalPageTitle } from "@/lib/portal/ia";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { ownedAnalytics } from "@/lib/provider/owned-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: portalPageTitle(`/analytics/${slug}`),
    robots: { index: false, follow: false },
  };
}

export default async function AnalyticsSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await RequireVerifiedEmail();
  let rows: Record<string, unknown>[] = [];
  try { rows = await ownedAnalytics(user.userId); } catch { /* existing statement-backed page remains available */ }
  if (!rows.length) return <PortalFeaturePage href={`/analytics/${slug}`} />;
  return <div className="space-y-5"><PortalFeaturePage href={`/analytics/${slug}`} /><section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"><h2 className="text-h4">Distribution analytics</h2><p className="mt-1 text-caption text-[var(--nexo-text-muted)]">Verified rows for releases owned by this Nexo account.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-small"><thead><tr><th className="py-2">Release</th><th>Platform</th><th>Territory</th><th>Streams</th></tr></thead><tbody>{rows.slice(0,100).map((r,i)=><tr key={i} className="border-t border-[var(--nexo-border)]"><td className="py-2">{String(r.title??r.release_title??r.release_id??"—")}</td><td>{String(r.platform??r.channel??"—")}</td><td>{String(r.country??r.territory??"—")}</td><td>{String(r.streams??r.quantity??r.units??"—")}</td></tr>)}</tbody></table></div></section></div>;
}
