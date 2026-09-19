import type { ReadinessReport } from "@/lib/ddex/readiness";

function statusClass(status: string) {
  switch (status) {
    case "READY":
      return "text-emerald-600";
    case "WAITING_FOR_IDENTIFIERS":
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
  const identifierItems = report.items.filter(
    (item) => (item.key === "isrc" || item.key === "upc") && item.status !== "READY"
  );
  const hardDdexIssues = report.items.filter(
    (item) =>
      item.scope === "dsp" &&
      item.key !== "isrc" &&
      item.key !== "upc" &&
      (item.status === "ERROR" || item.status === "MISSING")
  );
  const waitingForIdentifiers =
    identifierItems.length > 0 && hardDdexIssues.length === 0;
  const ddexDisplayStatus = waitingForIdentifiers
    ? "WAITING_FOR_IDENTIFIERS"
    : report.dspStatus;

  return (
    <div className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5">
      <div>
        <h2 className="text-h4">DDEX / delivery readiness</h2>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          This panel separates Nexo/TooLost distribution readiness from manual DDEX ERN
          generation. UPC and ISRC may be left blank during upload when they will be assigned
          later; they are still required before a manual ERN package can be generated.
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
          DDEX ERN:{" "}
          <strong className={statusClass(ddexDisplayStatus)}>
            {waitingForIdentifiers ? "WAITING FOR IDENTIFIERS" : report.dspStatus}
          </strong>
        </span>
        {waitingForIdentifiers ? (
          <span className="text-amber-600">
            Does not block Nexo provider delivery · manual ERN waits for UPC/ISRC
          </span>
        ) : report.canGenerate ? (
          <span className="text-emerald-600">Can generate ERN 4.3.2</span>
        ) : (
          <span className="text-[var(--nexo-text-muted)]">
            Manual DDEX generation blocked until the listed DDEX issues are resolved
          </span>
        )}
      </div>
      <ul className="space-y-2 text-small">
        {report.items.map((item) => (
          <li key={`${item.scope}-${item.key}`} className="flex flex-wrap gap-2">
            <span className="min-w-[7rem] uppercase text-caption text-[var(--nexo-text-muted)]">
              {item.scope}
            </span>
            <span className={statusClass(
              waitingForIdentifiers &&
                (item.key === "isrc" || item.key === "upc") &&
                item.status !== "READY"
                ? "WAITING_FOR_IDENTIFIERS"
                : item.status
            )}>
              {waitingForIdentifiers &&
              (item.key === "isrc" || item.key === "upc") &&
              item.status !== "READY"
                ? "WAITING"
                : item.status}
            </span>
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
