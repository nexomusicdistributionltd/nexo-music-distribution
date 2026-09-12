import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";

/** Conceptual showcase only — demo values, not real company results. */
export function DashboardMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-lg)]",
        className
      )}
      aria-label="Demo dashboard showcase"
    >
      <div className="flex items-center justify-between border-b border-[var(--nexo-divider)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--nexo-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--nexo-border-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--nexo-border-strong)]" />
        </div>
        <p className="text-caption text-[var(--nexo-text-muted)]">NEXO · Demo UI</p>
        <span className="rounded-full border border-[var(--nexo-border)] px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-[var(--nexo-text-muted)]">
          Showcase
        </span>
      </div>
      <div className="grid md:grid-cols-[9rem_1fr]">
        <aside className="hidden border-r border-[var(--nexo-divider)] bg-[var(--nexo-elevated)] p-4 md:block">
          <p className="text-caption font-semibold tracking-wide text-[var(--nexo-text)]">NEXO</p>
          <ul className="mt-4 space-y-2 text-caption text-[var(--nexo-text-muted)]">
            {["Dashboard", "Releases", "Earnings", "Analytics", "Publishing"].map((item, i) => (
              <li
                key={item}
                className={cn(
                  "rounded px-2 py-1.5",
                  i === 0 && "bg-[var(--nexo-card)] font-medium text-[var(--nexo-text)]"
                )}
              >
                {item}
              </li>
            ))}
          </ul>
        </aside>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-small text-[var(--nexo-text-muted)]">Welcome back</p>
              <p className="text-h4 text-[var(--nexo-text)]">Demo Artist</p>
            </div>
            <p className="text-caption text-[var(--nexo-text-muted)]">Illustrative figures only</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Total Releases", value: "12" },
              { label: "Total Streams", value: "1.2M" },
              { label: "Estimated Earnings", value: "$2,480" },
              { label: "Available Balance", value: "$1,250" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-3"
              >
                <p className="text-caption text-[var(--nexo-text-muted)]">{stat.label}</p>
                <p className="mt-1 text-h4 text-[var(--nexo-text)]">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-chart-surface)] p-4">
            <p className="text-caption font-medium text-[var(--nexo-text-secondary)]">
              Streams Overview · Demo
            </p>
            <svg viewBox="0 0 400 120" className="mt-3 h-28 w-full" aria-hidden>
              <defs>
                <linearGradient id="nexoDemoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--nexo-text)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--nexo-text)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[20, 40, 60, 80, 100].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="400"
                  y1={y}
                  y2={y}
                  stroke="var(--nexo-chart-grid)"
                  strokeWidth="1"
                />
              ))}
              <path
                d="M0,95 C40,90 60,70 100,75 C140,80 160,45 200,50 C240,55 260,30 300,35 C340,40 360,20 400,25 L400,120 L0,120 Z"
                fill="url(#nexoDemoFill)"
              />
              <path
                d="M0,95 C40,90 60,70 100,75 C140,80 160,45 200,50 C240,55 260,30 300,35 C340,40 360,20 400,25"
                fill="none"
                stroke="var(--nexo-chart-line)"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="mt-4 overflow-hidden rounded-[var(--nexo-radius)] border border-[var(--nexo-border)]">
            <div className="border-b border-[var(--nexo-divider)] px-3 py-2 text-caption font-medium text-[var(--nexo-text-secondary)]">
              Recent Releases · Demo
            </div>
            <ul className="divide-y divide-[var(--nexo-divider)]">
              {[
                { title: "Midnight Signal", status: "live" as const, label: "Live", date: "Mar 12" },
                { title: "Glass Rooms EP", status: "processing" as const, label: "Processing", date: "Mar 18" },
                { title: "Northbound", status: "pending" as const, label: "Scheduled", date: "Apr 02" },
              ].map((row) => (
                <li
                  key={row.title}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-small"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-8 w-8 rounded bg-[var(--nexo-elevated)] ring-1 ring-[var(--nexo-border)]"
                      aria-hidden
                    />
                    <span className="text-[var(--nexo-text)]">{row.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={row.status} label={row.label} />
                    <span className="hidden text-caption text-[var(--nexo-text-muted)] sm:inline">
                      {row.date}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
