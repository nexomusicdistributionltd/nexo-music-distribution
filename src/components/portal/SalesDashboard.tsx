import { DspIcon } from "@/components/fanlink/DspIcon";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageIntro } from "@/components/workspace/PageIntro";
import {
  loadSalesSnapshot,
  SALES_PAGE_COPY,
  type SalesDisplayRow,
  type SalesViewKey,
} from "@/lib/portal/sales";

function formatNumber(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
}

function formatMoney(value: number | null, currency: string | null): string {
  if (value == null) return "—";
  if (currency && /^[A-Z]{3}$/i.test(currency)) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
        maximumFractionDigits: 6,
      }).format(value);
    } catch {
      // Unknown currency codes fall through to an unlabelled numeric value.
    }
  }
  return formatNumber(value);
}

function iconKey(channel: string | null): string | null {
  const value = (channel ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("spotify")) return "spotify";
  if (value.includes("apple")) return "apple_music";
  if (value.includes("youtube")) return "youtube";
  if (value.includes("amazon")) return "amazon_music";
  if (value.includes("deezer")) return "deezer";
  if (value.includes("tidal")) return "tidal";
  if (value.includes("pandora")) return "pandora";
  if (value.includes("audiomack")) return "audiomack";
  if (value.includes("soundcloud")) return "soundcloud";
  if (value.includes("tiktok")) return "tiktok";
  if (value.includes("meta") || value.includes("facebook") || value.includes("instagram")) return "facebook";
  return null;
}

function RowCard({ row, view }: { row: SalesDisplayRow; view: SalesViewKey }) {
  const dsp = iconKey(row.channel ?? (view === "channels" || view === "stream_rates" ? row.title : null));
  const isStreamRate = view === "stream_rates";

  return (
    <li className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {dsp ? <DspIcon name={dsp} className="h-5 w-5 shrink-0" /> : null}
            <p className="truncate font-medium">
              {row.title || row.channel || row.territory || row.date || "Sales row"}
            </p>
          </div>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            {[row.subtitle, row.channel, row.territory, row.date].filter(Boolean).join(" · ") || "Reported activity"}
          </p>
        </div>
        {row.trendPercent != null ? (
          <span className="shrink-0 rounded-full border border-[var(--nexo-border)] px-2 py-1 text-caption tabular-nums">
            {row.trendPercent > 0 ? "+" : ""}{formatNumber(row.trendPercent)}%
          </span>
        ) : null}
      </div>

      {isStreamRate ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-caption text-[var(--nexo-text-muted)]">Stream rate</dt>
            <dd className="mt-1 text-small font-medium tabular-nums">
              {row.streamRate == null ? "—" : formatMoney(row.streamRate, row.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-[var(--nexo-text-muted)]">Territory</dt>
            <dd className="mt-1 text-small font-medium">{row.territory || "—"}</dd>
          </div>
          <div>
            <dt className="text-caption text-[var(--nexo-text-muted)]">Period</dt>
            <dd className="mt-1 text-small font-medium">{row.date || "—"}</dd>
          </div>
        </dl>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-caption text-[var(--nexo-text-muted)]">Streams</dt>
            <dd className="mt-1 text-small font-medium tabular-nums">{formatNumber(row.streams)}</dd>
          </div>
          <div>
            <dt className="text-caption text-[var(--nexo-text-muted)]">Units</dt>
            <dd className="mt-1 text-small font-medium tabular-nums">{formatNumber(row.units)}</dd>
          </div>
          <div>
            <dt className="text-caption text-[var(--nexo-text-muted)]">Total</dt>
            <dd className="mt-1 text-small font-medium tabular-nums">{formatMoney(row.total, row.currency)}</dd>
          </div>
          <div>
            <dt className="text-caption text-[var(--nexo-text-muted)]">Currency</dt>
            <dd className="mt-1 text-small font-medium">{row.currency?.toUpperCase() || "—"}</dd>
          </div>
        </dl>
      )}
    </li>
  );
}

function emptyCopy(view: SalesViewKey): { title: string; description: string } {
  if (view === "stream_rates") {
    return {
      title: "No stream-rate data yet",
      description:
        "Stream-rate rows will appear here as soon as reporting is available for the selected services and territories.",
    };
  }
  if (view === "monthly" || view === "overview") {
    return {
      title: "No reported activity yet",
      description:
        "Monthly sales and streaming activity will appear here after stores and services report activity for your catalog.",
    };
  }
  return {
    title: "No reported activity yet",
    description:
      "Sales and streaming activity will appear here after stores and services report activity for your catalog.",
  };
}

export async function SalesDashboard({
  ownerUserId,
  view,
}: {
  ownerUserId: string;
  view: SalesViewKey;
}) {
  const copy = SALES_PAGE_COPY[view];
  const snapshot = await loadSalesSnapshot(ownerUserId, view);
  const rowsWithStreams = snapshot.rows.filter((row) => row.streams != null && row.streams >= 0);
  const maxStreams = rowsWithStreams.reduce((max, row) => Math.max(max, row.streams ?? 0), 0);
  const empty = emptyCopy(view);

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Sales" title={copy.title} description={copy.description} />

      {snapshot.status === "unavailable" ? (
        <Alert variant="warning" title="Reporting temporarily unavailable">
          {snapshot.note}
        </Alert>
      ) : null}

      {snapshot.status === "ready" && rowsWithStreams.length > 0 && maxStreams > 0 ? (
        <section className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
          <h2 className="text-h4">Stream activity</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Latest reported stream counts for music in this account.
          </p>
          <div className="mt-5 space-y-3">
            {rowsWithStreams.slice(0, 12).map((row) => (
              <div key={`chart-${row.id}`} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
                <span className="truncate text-caption">{row.channel || row.title || row.date || "Streams"}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--nexo-chart-grid)]">
                  <div
                    className="h-full rounded-full bg-[var(--nexo-text)]"
                    style={{ width: `${Math.max(2, ((row.streams ?? 0) / maxStreams) * 100)}%` }}
                  />
                </div>
                <span className="min-w-14 text-right text-caption tabular-nums">
                  {formatNumber(row.streams)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {snapshot.status === "empty" ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : snapshot.status === "ready" ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {snapshot.rows.slice(0, 200).map((row, index) => (
            <RowCard key={`${row.id}-${index}`} row={row} view={view} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
