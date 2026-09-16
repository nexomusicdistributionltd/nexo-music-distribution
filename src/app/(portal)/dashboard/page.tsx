import type { Metadata } from "next";
import { PlanFeaturesPanel } from "@/components/billing/PlanFeaturesPanel";
import { PortalOverview } from "@/components/portal/PortalOverview";
import { RequireRole } from "@/lib/auth/guards";
import { artistNameOf } from "@/lib/auth/types";
import { safeGetEntitlementsForAuth } from "@/lib/billing/queries";
import { loadAnalyticsSnapshot } from "@/lib/portal/analytics";
import {
  buildBalanceOverview,
  streamOverviewHeadline,
  streamOverviewRows,
  unenrolledServiceCount,
} from "@/lib/portal/overview";
import { ENROLLABLE_SERVICES } from "@/lib/portal/service-kinds";
import { mapArtworkUrls } from "@/lib/releases/artwork";
import {
  countUnreadNotifications,
  listActionNeededReleases,
  listRecentReleases,
} from "@/lib/releases/queries";
import {
  getArtistProfileForUser,
  getLabelProfileForUser,
} from "@/lib/roster/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const ctx = await RequireRole(["artist", "label"]);
  const isLabel = ctx.roles.includes("label");
  const fallbackName = ctx.profile?.display_name || ctx.profile?.full_name || "there";
  const entitlements = await safeGetEntitlementsForAuth(ctx);

  let welcomeName = fallbackName;
  let recent: Awaited<ReturnType<typeof listRecentReleases>> = [];
  let actionNeeded: Awaited<ReturnType<typeof listActionNeededReleases>> = [];
  let unread = 0;
  let enrolledKeys: string[] = [];
  let loadError: string | null = null;
  let ledger: {
    currency: string;
    available_minor: number;
    pending_minor: number;
    paid_minor: number;
  } | null = null;
  let statement: {
    currency: string | null;
    period_end: string | null;
    opening_minor: number | null;
    earnings_minor: number | null;
    adjustments_minor: number | null;
    payouts_minor: number | null;
    closing_minor: number | null;
  } | null = null;

  const streamSnap = await loadAnalyticsSnapshot(ctx.userId, "streams").catch(() => null);

  try {
    const supabase = await createClient();
    const [rec, act, unreadCount, balances, statements, enrollments] = await Promise.all([
      listRecentReleases(ctx.userId, 4),
      listActionNeededReleases(ctx.userId, 6),
      countUnreadNotifications(ctx.userId),
      supabase
        .from("ledger_balances")
        .select("currency, available_minor, pending_minor, paid_minor")
        .eq("owner_user_id", ctx.userId),
      supabase
        .from("royalty_statements")
        .select("currency, period_end, opening_minor, earnings_minor, adjustments_minor, payouts_minor, closing_minor")
        .eq("owner_user_id", ctx.userId)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("account_enrollments").select("service_key").eq("owner_user_id", ctx.userId),
    ]);
    recent = rec;
    actionNeeded = act;
    unread = unreadCount;
    const ledgerRows = (balances.data ?? []) as Array<{
      currency: string;
      available_minor: number;
      pending_minor: number;
      paid_minor: number;
    }>;
    ledger = ledgerRows[0] ?? null;
    statement = statements.data
      ? {
          currency: statements.data.currency ?? ledger?.currency ?? null,
          period_end: statements.data.period_end ?? null,
          opening_minor: statements.data.opening_minor ?? null,
          earnings_minor: statements.data.earnings_minor ?? null,
          adjustments_minor: statements.data.adjustments_minor ?? null,
          payouts_minor: statements.data.payouts_minor ?? null,
          closing_minor: statements.data.closing_minor ?? null,
        }
      : null;
    enrolledKeys = (enrollments.data ?? []).map((r) => String(r.service_key));
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load dashboard data.";
  }

  if (isLabel) {
    const label = await getLabelProfileForUser(ctx.userId).catch(() => null);
    welcomeName = label?.label_name || fallbackName;
  } else {
    const artist = await getArtistProfileForUser(ctx.userId).catch(() => null);
    welcomeName = artist ? artistNameOf(artist) : fallbackName;
  }

  const artwork = await mapArtworkUrls(recent.map((r) => r.id)).catch(() => ({} as Record<string, string | null>));
  const headline = streamOverviewHeadline({
    connected: streamSnap?.connected ?? false,
    rowCount: streamSnap?.rowCount ?? 0,
  });
  const streamRows = streamOverviewRows(
    streamSnap?.dspCodes ?? [],
    headline.status === "LIVE" ? "EMPTY" : headline.status
  );
  const balance = buildBalanceOverview({ statement, ledger });

  return (
    <>
      <PortalOverview
        welcomeName={welcomeName}
        thumbs={recent.map((r) => ({
          id: r.id,
          title: r.title || "Untitled draft",
          src: artwork[r.id] ?? null,
        }))}
        unreadNotifications={unread}
        unenrolledCount={unenrolledServiceCount(ENROLLABLE_SERVICES.length, enrolledKeys)}
        enrollableCount={ENROLLABLE_SERVICES.length}
        streamRows={streamRows}
        streamStatus={headline.status}
        streamNote={headline.chartNote}
        balance={balance}
        actionNeeded={actionNeeded.map((r) => ({ id: r.id, title: r.title || "Untitled" }))}
        loadError={loadError}
      />
      <div className="mt-4 pb-8">
        <PlanFeaturesPanel entitlements={entitlements} />
      </div>
    </>
  );
}
