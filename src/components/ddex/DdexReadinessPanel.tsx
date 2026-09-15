import type { ReadinessReport } from "@/lib/ddex/readiness";

function statusClass(status: string) {
  switch (status) {
    case "READY":
      return "text-emerald-600";
    case "REQUIRES_ACTION":
      return "text-amber-600";
    case "ERROR":
      return "text-rose-700";
    default:
      return "text-rose-600";
  }
}

/**
 * Additive DDEX readiness display for admin QC — does not replace the QC checklist.
 */
export function DdexReadinessPanel({ report }: { report: ReadinessReport }) {
  return (
    <div className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5">
      <div>
        <h2 className="text-h4">DDEX / delivery readiness</h2>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          Advisory only for drafts — complements QC checklist. Missing ISRC/UPC is a DDEX
          ERROR and blocks ERN generation without fabricating identifiers. Generate XML from
          the DDEX admin section.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 text-small">
        <span>
          Nexo:{" "}
          <strong className={statusClass(report.nexoStatus)}>
            {report.nexoStatus}
          </strong>
        </span>
        <span>
          DSP / DDEX:{" "}
          <strong className={statusClass(report.dspStatus)}>
            {report.dspStatus}
          </strong>
        </span>
        {report.blocksDspDelivery ? (
          <span className="text-[var(--nexo-text-muted)]">
            Blocks DSP delivery until resolved
          </span>
        ) : null}
        {report.canGenerate ? (
          <span className="text-emerald-600">Can generate ERN 4.3.2</span>
        ) : (
          <span className="text-[var(--nexo-text-muted)]">Cannot generate ERN yet</span>
        )}
      </div>
      <ul className="space-y-2 text-small">
        {report.items.map((item) => (
          <li key={`${item.scope}-${item.key}`} className="flex flex-wrap gap-2">
            <span className="min-w-[7rem] uppercase text-caption text-[var(--nexo-text-muted)]">
              {item.scope}
            </span>
            <span className={statusClass(item.status)}>{item.status}</span>
            <span>{item.label}</span>
            {item.detail ? (
              <span className="text-[var(--nexo-text-muted)]">— {item.detail}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
