import { adminBillingCatalog } from "@/lib/billing/admin-catalog";

export function AdminPlanCatalogPanel() {
  const catalog = adminBillingCatalog();
  return (
    <section className="mb-8 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4">
      <h2 className="text-h4">Plan catalog</h2>
      <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
        Starter/Pro amounts and trials from server config. Price ID presence only — no secrets.
        Environment: {catalog.environment ?? "unset"}. Client token:{" "}
        {catalog.clientTokenPresent ? "present" : "missing"}.
      </p>
      {catalog.message ? (
        <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">{catalog.message}</p>
      ) : null}
      {catalog.rows.length === 0 ? (
        <p className="mt-4 text-small text-[var(--nexo-text-muted)]">No plans configured.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-small">
            <thead className="text-caption uppercase tracking-[0.08em] text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-2 py-2">Plan</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Monthly</th>
                <th className="px-2 py-2">Annual</th>
                <th className="px-2 py-2">Trial</th>
                <th className="px-2 py-2">Price IDs</th>
              </tr>
            </thead>
            <tbody>
              {catalog.rows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--nexo-divider)]">
                  <td className="px-2 py-2 font-medium">{row.name}</td>
                  <td className="px-2 py-2">{row.accountType}</td>
                  <td className="px-2 py-2">{row.amounts.month ?? "—"}</td>
                  <td className="px-2 py-2">{row.amounts.year ?? "—"}</td>
                  <td className="px-2 py-2">{row.trialDays ? `${row.trialDays} days` : "—"}</td>
                  <td className="px-2 py-2 text-caption">
                    {row.free
                      ? "n/a (free)"
                      : `month ${row.priceIdPresent.month ? "set" : "unset"} · year ${row.priceIdPresent.year ? "set" : "unset"}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
