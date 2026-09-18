/** Home/overview helpers. Stream counts are never invented. */

export type StreamOverviewStatus = "LIVE" | "CONNECTED" | "UNAVAILABLE";

export const STREAM_OVERVIEW_DSPS = [
  { id: "audiomack", label: "Audiomack", match: ["audiomack"] },
  { id: "spotify", label: "Spotify", match: ["spotify"] },
  { id: "apple_music", label: "Apple Music", match: ["apple", "apple_music"] },
  { id: "youtube", label: "YouTube", match: ["youtube"] },
  { id: "amazon", label: "Amazon", match: ["amazon"] },
  { id: "deezer", label: "Deezer", match: ["deezer"] },
  { id: "tidal", label: "Tidal", match: ["tidal"] },
  { id: "pandora", label: "Pandora", match: ["pandora"] },
] as const;

export type StreamOverviewRow = {
  id: string;
  label: string;
  status: StreamOverviewStatus;
  statementRows: number;
  streamCount: number | null;
  trendPercent: number | null;
};

function codeMatches(dspCode: string, needles: readonly string[]): boolean {
  const n = dspCode.toLowerCase();
  return needles.some((needle) => n === needle || n.includes(needle));
}

export function countByMatchedDsp(dspCodes: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const raw of dspCodes) {
    const code = String(raw || "").trim();
    if (!code) continue;
    counts[code] = (counts[code] ?? 0) + 1;
  }
  return counts;
}

export function streamOverviewRows(
  liveDspCodes: string[],
  idleStatus: StreamOverviewStatus = "CONNECTED",
  liveStreamCounts: Record<string, number> = {},
  liveTrendPercentByDsp: Record<string, number> = {}
): StreamOverviewRow[] {
  const counts = countByMatchedDsp(liveDspCodes);
  const used = new Set<string>();
  const rows: StreamOverviewRow[] = STREAM_OVERVIEW_DSPS.map((dsp) => {
    let statementRows = 0;
    for (const [code, n] of Object.entries(counts)) {
      if (codeMatches(code, dsp.match)) {
        statementRows += n;
        used.add(code);
      }
    }
    let streamCount = 0;
    let hasStreamCount = false;
    for (const [code, value] of Object.entries(liveStreamCounts)) {
      if (codeMatches(code, dsp.match) && Number.isFinite(value)) {
        streamCount += value;
        hasStreamCount = true;
      }
    }
    const matchingTrends = Object.entries(liveTrendPercentByDsp)
      .filter(([code, value]) => codeMatches(code, dsp.match) && Number.isFinite(value))
      .map(([, value]) => value);
    const uniqueTrends = [...new Set(matchingTrends)];
    const trendPercent = uniqueTrends.length === 1 ? uniqueTrends[0] : null;

    return {
      id: dsp.id,
      label: dsp.label,
      status: statementRows > 0 || hasStreamCount || trendPercent != null ? "LIVE" : idleStatus,
      statementRows,
      streamCount: hasStreamCount ? streamCount : null,
      trendPercent,
    };
  });

  for (const [code, n] of Object.entries(counts)) {
    if (used.has(code) || n <= 0) continue;
    rows.push({
      id: code,
      label: code,
      status: "LIVE",
      statementRows: n,
      streamCount: Number.isFinite(liveStreamCounts[code]) ? liveStreamCounts[code] : null,
      trendPercent: Number.isFinite(liveTrendPercentByDsp[code])
        ? liveTrendPercentByDsp[code]
        : null,
    });
  }
  return rows;
}

export function streamOverviewHeadline(opts: {
  connected: boolean;
  rowCount: number;
}): { status: StreamOverviewStatus; chartNote: string } {
  if (opts.rowCount > 0) {
    return {
      status: "LIVE",
      chartNote:
        "Distribution analytics are synced for this catalog. Stream totals come only from reported stream/play metrics, and trends use reported or consecutive dated analytics.",
    };
  }
  if (!opts.connected) {
    return {
      status: "UNAVAILABLE",
      chartNote:
        "Distribution analytics are temporarily unavailable. No stream counts or trends are estimated.",
    };
  }
  return {
    status: "CONNECTED",
    chartNote:
      "Distribution analytics are connected. DSP reporting will populate as soon as the provider returns activity for this catalog.",
  };
}

export type StatementLike = {
  currency: string | null;
  period_start?: string | null;
  period_end?: string | null;
  opening_minor?: number | null;
  earnings_minor?: number | null;
  adjustments_minor?: number | null;
  payouts_minor?: number | null;
  closing_minor?: number | null;
};

export type LedgerLike = {
  currency: string;
  available_minor: number;
  pending_minor: number;
  paid_minor: number;
  held_minor?: number;
};

export type BalanceOverview = {
  hasLedgerData: boolean;
  currency: string;
  periodLabel: string | null;
  openingMinor: number | null;
  earningsMinor: number | null;
  adjustmentsMinor: number | null;
  paymentsMinor: number | null;
  outstandingMinor: number;
  note: string;
};

export function formatReportingPeriod(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function buildBalanceOverview(input: {
  statement: StatementLike | null;
  ledger: LedgerLike | null;
}): BalanceOverview {
  const { statement, ledger } = input;
  if (statement) {
    const currency = (statement.currency || ledger?.currency || "USD").toUpperCase();
    const outstanding =
      statement.closing_minor != null
        ? Number(statement.closing_minor)
        : ledger
          ? Number(ledger.available_minor)
          : 0;
    return {
      hasLedgerData: true,
      currency,
      periodLabel: formatReportingPeriod(statement.period_end),
      openingMinor: statement.opening_minor == null ? null : Number(statement.opening_minor),
      earningsMinor: statement.earnings_minor == null ? null : Number(statement.earnings_minor),
      adjustmentsMinor: statement.adjustments_minor == null ? null : Number(statement.adjustments_minor),
      paymentsMinor: statement.payouts_minor == null ? null : Number(statement.payouts_minor),
      outstandingMinor: outstanding,
      note: "Figures come from posted royalty statements and ledger rows only.",
    };
  }
  if (ledger) {
    return {
      hasLedgerData: true,
      currency: ledger.currency.toUpperCase(),
      periodLabel: null,
      openingMinor: null,
      earningsMinor: null,
      adjustmentsMinor: null,
      paymentsMinor: Number(ledger.paid_minor),
      outstandingMinor: Number(ledger.available_minor),
      note: "Outstanding is available ledger balance. Period earnings appear after a statement is posted.",
    };
  }
  return {
    hasLedgerData: false,
    currency: "USD",
    periodLabel: null,
    openingMinor: null,
    earningsMinor: null,
    adjustmentsMinor: null,
    paymentsMinor: null,
    outstandingMinor: 0,
    note: "No financial data available yet. Outstanding $0.00 is not estimated earnings.",
  };
}

export function unenrolledServiceCount(enrollable: number, enrolledKeys: string[]): number {
  const unique = new Set(enrolledKeys.filter(Boolean));
  return Math.max(0, enrollable - unique.size);
}

export const OVERVIEW_HREFS = {
  releases: "/dashboard/releases",
  createRelease: "/dashboard/releases/new",
  videos: "/dashboard/videos",
  updates: "/help/knowledge-base",
  enrollments: "/account/enrollments",
  streams: "/analytics/streams",
  royalties: "/earnings",
  support: "/support",
} as const;
