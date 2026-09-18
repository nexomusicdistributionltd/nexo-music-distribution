import { EmptyState } from "@/components/ui/EmptyState";

type Json = Record<string, unknown>;

function objectRows(payload: unknown): Json[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (value): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value)
    );
  }
  if (!payload || typeof payload !== "object") return [];
  const outer = payload as Json;
  if (Array.isArray(outer.data)) {
    return outer.data.filter(
      (value): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value)
    );
  }
  const data =
    outer.data && typeof outer.data === "object" && !Array.isArray(outer.data)
      ? (outer.data as Json)
      : outer;
  for (const key of [
    "items",
    "releases",
    "tracks",
    "artists",
    "channels",
    "territories",
    "analytics",
    "sales",
    "results",
  ]) {
    if (Array.isArray(data[key])) {
      return (data[key] as unknown[]).filter(
        (value): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value)
      );
    }
  }
  return [];
}

function displayValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const text = JSON.stringify(value);
    return text.length > 140 ? `${text.slice(0, 137)}…` : text;
  } catch {
    return "[value]";
  }
}

export function ProviderDataTable({
  title,
  description,
  payload,
  error,
  maxRows = 25,
}: {
  title: string;
  description?: string;
  payload: unknown;
  error?: string | null;
  maxRows?: number;
}) {
  if (error) {
    return (
      <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-warning)]/40 bg-[var(--nexo-card)] p-5">
        <h2 className="text-h4">{title}</h2>
        {description ? <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{description}</p> : null}
        <p className="mt-3 text-small text-[var(--nexo-warning)]">{error}</p>
      </section>
    );
  }

  const rows = objectRows(payload).slice(0, maxRows);
  if (!rows.length) {
    return (
      <section>
        <h2 className="mb-3 text-h4">{title}</h2>
        <EmptyState title="No provider rows returned" description={description} />
      </section>
    );
  }

  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row)))
  ).slice(0, 10);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h4">{title}</h2>
        {description ? <p className="text-caption text-[var(--nexo-text-muted)]">{description}</p> : null}
      </div>
      <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
        <table className="min-w-full text-left text-caption">
          <thead className="bg-[var(--nexo-surface)] text-[var(--nexo-text-muted)]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">
                  {column.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--nexo-border)]">
            {rows.map((row, index) => (
              <tr key={String(row.id ?? row.release_id ?? row.period ?? index)}>
                {columns.map((column) => (
                  <td key={column} className="max-w-[22rem] px-3 py-2 align-top">
                    <span className="line-clamp-3 break-words">{displayValue(row[column])}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Showing {rows.length} live provider row{rows.length === 1 ? "" : "s"}. Values are not estimated.
      </p>
    </section>
  );
}
