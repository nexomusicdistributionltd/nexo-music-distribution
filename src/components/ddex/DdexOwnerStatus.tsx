import type { OwnerDdexStatusRow } from "@/lib/ddex/types";

export function DdexOwnerStatus({ rows }: { rows: OwnerDdexStatusRow[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-h4">Delivery status</h2>
      <p className="text-small text-[var(--nexo-text-muted)]">
        Status only. DSP credentials and endpoints are not available on artist or label accounts.
        A local test delivery is not a commercial DSP release.
      </p>
      {rows.length === 0 ? (
        <p className="text-small text-[var(--nexo-text-muted)]">No DDEX messages yet.</p>
      ) : (
        <ul className="space-y-2 text-small">
          {rows.map((row) => (
            <li key={row.message_id} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
              <p className="font-medium">
                {row.message_subtype} · {row.delivery_status.replaceAll("_", " ")}
              </p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                validation {row.validation_status}
                {row.package_status && row.package_status !== "none" ? ` · package ${row.package_status}` : ""}
                {row.target_name ? ` · ${row.target_is_test ? "Test target" : row.target_name}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
